'use strict'

const _ = require('lodash')
const asar = require('asar')
const debug = require('debug')
const fs = require('fs-extra')
const fsize = require('get-folder-size')
const glob = require('glob')
const mkdirp = require('mkdirp')
const nodeify = require('nodeify')
const path = require('path')
const pify = require('pify')
const temp = require('temp').track()
const wrap = require('word-wrap')

const dependencies = require('./dependencies')
const spawn = require('./spawn')

const defaultLogger = debug('electron-installer-debian')

const defaultRename = (dest, src) => {
  return path.join(dest, '<%= name %>_<%= version %>_<%= arch %>.deb')
}

function errorMessage (message, err) {
  return `Error ${message}: ${err.message || err}`
}

function wrapError (message) {
  return err => {
    throw new Error(errorMessage(message, err))
  }
}

/**
 * Read `package.json` either from `resources/app.asar` (if the app is packaged)
 * or from `resources/app/package.json` (if it is not).
 */
function readMeta (options) {
  const appAsarPath = path.join(options.src, 'resources/app.asar')
  const appPackageJSONPath = path.join(options.src, 'resources/app/package.json')

  return fs.pathExists(appAsarPath)
    .then(asarExists => {
      if (asarExists) {
        options.logger(`Reading package metadata from ${appAsarPath}`)
        return JSON.parse(asar.extractFile(appAsarPath, 'package.json'))
      } else {
        options.logger(`Reading package metadata from ${appPackageJSONPath}`)
        return fs.readJson(appPackageJSONPath)
      }
    }).catch(wrapError('reading package metadata'))
}

/**
 * Read `LICENSE` from the root of the app.
 */
function copyLicense (options, copyrightFile) {
  const licenseSrc = path.join(options.src, 'LICENSE')
  options.logger(`Copying license file from ${licenseSrc}`)

  return fs.copy(licenseSrc, copyrightFile)
}

/**
 * Get the size of the app.
 */
function getSize (options) {
  return pify(fsize)(options.src)
}

/**
 * Get the hash of default options for the installer. Some come from the info
 * read from `package.json`, and some are hardcoded.
 */
function getDefaults (data) {
  const src = {src: data.src}
  return Promise.all([readMeta(data), getSize(src), dependencies.getTrashDepends(src)])
    .then(results => {
      const pkg = results[0] || {}
      const size = results[1] || 0
      const trashDependencies = results[2] || 'gvfs-bin'

      return {
        name: pkg.name || 'electron',
        productName: pkg.productName || pkg.name,
        genericName: pkg.genericName || pkg.productName || pkg.name,
        description: pkg.description,
        productDescription: pkg.productDescription || pkg.description,
        // Use '~' on pre-releases for proper Debian version ordering.
        // See https://www.debian.org/doc/debian-policy/ch-controlfields.html#s-f-Version
        version: (pkg.version || '0.0.0').replace(/(\d)[_.+-]?((RC|rc|pre|dev|beta|alpha)[_.+-]?\d*)$/, '$1~$2'),
        revision: pkg.revision || '1',

        section: 'utils',
        priority: 'optional',
        arch: undefined,
        size: Math.ceil(size / 1024),

        depends: dependencies.getDepends(trashDependencies),
        recommends: [
          'pulseaudio | libasound2'
        ],
        suggests: [
          'gir1.2-gnomekeyring-1.0',
          'libgnome-keyring0',
          'lsb-release'
        ],
        enhances: [
        ],
        preDepends: [
        ],

        maintainer: pkg.author && (typeof pkg.author === 'string'
          ? pkg.author.replace(/\s+\([^)]+\)/, '')
          : pkg.author.name +
          (pkg.author.email != null ? ` <${pkg.author.email}>` : '')
        ),

        homepage: pkg.homepage || (pkg.author && (typeof pkg.author === 'string'
          ? pkg.author.replace(/.*\(([^)]+)\).*/, '$1')
          : pkg.author.url
        )),

        bin: pkg.name || 'electron',
        icon: path.resolve(__dirname, '../resources/icon.png'),

        categories: [
          'GNOME',
          'GTK',
          'Utility'
        ],

        mimeType: [],

        lintianOverrides: []
      }
    })
}

/**
 * Get the hash of options for the installer.
 */
function getOptions (data, defaults) {
  // Flatten everything for ease of use.
  const options = _.defaults({}, data, data.options, defaults)

  if (!options.description && !options.productDescription) {
    throw new Error('No Description or ProductDescription provided')
  }

  if (options.description) {
    // Replace all newlines in the description with spaces, since it's supposed
    // to be one line.
    options.description = options.description.replace(/[\r\n]+/g, ' ')
  }

  if (options.productDescription) {
    // Ensure blank lines have the "." that denotes a blank line in the control file.
    // Wrap any extended description lines to avoid lintian warning about
    // `extended-description-line-too-long`.
    options.productDescription = options.productDescription
      .replace(/\r\n/g, '\n') // Fixes errors when finding blank lines in Windows
      .replace(/^$/mg, '.')
      .split('\n')
      .map(line => wrap(line, {width: 80, indent: ' '}))
      .join('\n')
  }

  // Create array with unique values from default & user-supplied dependencies
  for (const prop of ['depends', 'recommends', 'suggests', 'enhances', 'preDepends']) {
    if (data.options) { // options passed programmatically
      options[prop] = _.union(defaults[prop], data.options[prop])
    } else { // options passed via command-line
      options[prop] = _.union(defaults[prop], data[prop])
    }
  }

  return options
}

/**
 * Fill in a template with the hash of options.
 */
function generateTemplate (options, file) {
  options.logger(`Generating template from ${file}`)

  return fs.readFile(file)
    .then(template => {
      const result = _.template(template)(options)
      options.logger(`Generated template from ${file}\n${result}`)
      return result
    })
}

/**
 * Create the control file for the package.
 *
 * See: https://www.debian.org/doc/debian-policy/ch-controlfields.html
 */
function createControl (options, dir) {
  const controlSrc = path.resolve(__dirname, '../resources/control.ejs')
  const controlDest = path.join(dir, 'DEBIAN/control')
  options.logger(`Creating control file at ${controlDest}`)

  return generateTemplate(options, controlSrc)
    .then(data => fs.outputFile(controlDest, data))
    .catch(wrapError('creating control file'))
}

/**
 * Copy debian scripts.
 */
function copyScripts (options, dir) {
  const scriptNames = ['preinst', 'postinst', 'prerm', 'postrm']

  return Promise.all(_.map(options.scripts, (item, key) => {
    if (_.includes(scriptNames, key)) {
      const scriptFile = path.join(dir, 'DEBIAN', key)
      options.logger(`Creating script file at ${scriptFile}`)

      return fs.copy(item, scriptFile)
    } else {
      throw new Error(`Wrong executable script name: ${key}`)
    }
  })).catch(wrapError('creating script files'))
}

/**
 * Create the binary for the package.
 */
function createBinary (options, dir) {
  const binDir = path.join(dir, 'usr/bin')
  const binSrc = path.join('../lib', options.name, options.bin)
  const binDest = path.join(binDir, options.name)
  options.logger(`Symlinking binary from ${binSrc} to ${binDest}`)

  return pify(mkdirp)(binDir, '0755')
    .catch(wrapError('creating binary path'))
    .then(() => fs.symlink(binSrc, binDest, 'file'))
    .catch(wrapError('creating binary file'))
}

/**
 * Create the desktop file for the package.
 *
 * See: http://standards.freedesktop.org/desktop-entry-spec/latest/
 */
function createDesktop (options, dir) {
  const desktopSrc = options.desktopTemplate || path.resolve(__dirname, '../resources/desktop.ejs')
  const desktopDest = path.join(dir, 'usr/share/applications', `${options.name}.desktop`)
  options.logger(`Creating desktop file at ${desktopDest}`)

  return pify(mkdirp)(path.dirname(desktopDest), '0755')
    .catch(wrapError('creating desktop path'))
    .then(() => generateTemplate(options, desktopSrc))
    .then(data => fs.outputFile(desktopDest, data))
    .then(() => fs.chmod(desktopDest, '0644'))
    .catch(wrapError('creating desktop file'))
}

/**
 * Create pixmap icon for the package.
 */
function createPixmapIcon (options, dir) {
  const iconFile = path.join(dir, 'usr/share/pixmaps', `${options.name}.png`)
  options.logger(`Creating icon file at ${iconFile}`)

  return pify(mkdirp)(path.dirname(iconFile), '0755')
    .catch(wrapError('creating icon path'))
    .then(() => fs.copy(options.icon, iconFile))
    .then(() => fs.chmod(iconFile, '0644'))
    .catch(wrapError('creating icon file'))
}

/**
 * Create hicolor icon for the package.
 */
function createHicolorIcon (options, dir) {
  return Promise.all(_.map(options.icon, (icon, resolution) => {
    const iconExt = resolution === 'scalable' ? 'svg' : 'png'
    const iconFile = path.join(dir, 'usr/share/icons/hicolor', resolution, 'apps', `${options.name}.${iconExt}`)
    options.logger(`Creating icon file at ${iconFile}`)

    return pify(mkdirp)(path.dirname(iconFile), '0755')
      .then(() => fs.copy(icon, iconFile))
      .then(() => fs.chmod(iconFile, '0644'))
      .catch(wrapError('creating icon file'))
  }))
}

/**
 * Create icon for the package.
 */
function createIcon (options, dir) {
  if (_.isObject(options.icon)) {
    return createHicolorIcon(options, dir)
  } else {
    return createPixmapIcon(options, dir)
  }
}

/**
 * Create copyright for the package.
 */
function createCopyright (options, dir) {
  const copyrightFile = path.join(dir, 'usr/share/doc', options.name, 'copyright')
  options.logger(`Creating copyright file at ${copyrightFile}`)

  return pify(mkdirp)(path.dirname(copyrightFile), '0755')
    .then(() => copyLicense(options, copyrightFile))
    .then(() => fs.chmod(copyrightFile, '0644'))
    .catch(wrapError('creating copyright file'))
}

/**
 * Create lintian overrides for the package.
 */
function createOverrides (options, dir) {
  const overridesSrc = path.resolve(__dirname, '../resources/overrides.ejs')
  const overridesDest = path.join(dir, 'usr/share/lintian/overrides', options.name)
  options.logger(`Creating lintian overrides at ${overridesDest}`)

  return pify(mkdirp)(path.dirname(overridesDest), '0755')
    .then(() => generateTemplate(options, overridesSrc))
    .then(data => fs.outputFile(overridesDest, data))
    .then(() => fs.chmod(overridesDest, '0644'))
    .catch(wrapError('creating lintian overrides file'))
}

/**
 * Copy the application into the package.
 */
function createApplication (options, dir) {
  const applicationDir = path.join(dir, 'usr/lib', options.name)
  const licenseFile = path.join(applicationDir, 'LICENSE')
  options.logger(`Copying application to ${applicationDir}`)

  return pify(mkdirp)(applicationDir, '0755')
    .then(() => fs.copy(options.src, applicationDir))
    .then(() => fs.unlink(licenseFile))
    .catch(wrapError('copying application directory'))
}

/**
 * Create temporary directory where the contents of the package will live.
 */
function createDir (options) {
  options.logger('Creating temporary directory')
  let tempDir

  return pify(temp.mkdir)('electron-')
    .then(dir => {
      tempDir = path.join(dir, `${options.name}_${options.version}_${options.arch}`)
      return pify(mkdirp)(tempDir, '0755')
    })
    .catch(wrapError('creating temporary directory'))
}

/**
 * Create the contents of the package.
 */
function createContents (options, dir) {
  options.logger('Creating contents of package')
  options.logger(`createContents(${options}, ${dir})`)

  return Promise.all([
    createControl,
    copyScripts,
    createBinary,
    createDesktop,
    createIcon,
    createCopyright,
    createOverrides,
    createApplication
  ].map(func => func(options, dir)))
    .then(() => dir)
}

/**
 * Package everything using `dpkg` and `fakeroot`.
 */
function createPackage (options, dir) {
  options.logger(`Creating package at ${dir}`)

  return spawn('fakeroot', ['dpkg-deb', '--build', dir], options.logger)
    .then(output => {
      options.logger(`dpkg-deb output: ${output}`)
      return dir
    })
}

/**
 * Move the package to the specified destination.
 */
function movePackage (options, dir) {
  options.logger('Moving package to destination')

  const packagePattern = path.join(dir, '../*.deb')
  return pify(glob)(packagePattern)
    .then(files => Promise.all(files.map(file => {
      const template = options.rename(options.dest, path.basename(file))
      const dest = _.template(template)(options)
      options.logger(`Moving file ${file} to ${dest}`)
      return fs.move(file, dest, {clobber: true})
    }))).catch(wrapError('moving package files'))
}

/* ************************************************************************** */

module.exports = (data, callback) => {
  data.rename = data.rename || defaultRename
  data.logger = data.logger || defaultLogger

  let options

  const promise = getDefaults(data)
    .then(defaults => getOptions(data, defaults))
    .then(generatedOptions => {
      options = generatedOptions
      return data.logger(`Creating package with options\n${JSON.stringify(options, null, 2)}`)
    }).then(() => createDir(options))
    .then(dir => createContents(options, dir))
    .then(dir => createPackage(options, dir))
    .then(dir => movePackage(options, dir))
    .then(() => {
      data.logger(`Successfully created package at ${options.dest}`)
      return options
    }).catch(err => {
      data.logger(errorMessage('creating package', err))
      throw err
    })

  return nodeify(promise, callback)
}
