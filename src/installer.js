'use strict'

const _ = require('lodash')
const common = require('electron-installer-common')
const debug = require('debug')
const fs = require('fs-extra')
const fsize = require('get-folder-size')
const path = require('path')
const pify = require('pify')
const wrap = require('word-wrap')

const debianDependencies = require('./dependencies')
const spawn = require('./spawn')

const defaultLogger = debug('electron-installer-debian')

const defaultRename = (dest, src) => {
  return path.join(dest, '<%= name %>_<%= version %>_<%= arch %>.deb')
}

/**
 * Get the size of the app.
 */
function getSize (appDir) {
  return pify(fsize)(appDir)
}

/**
 * Transforms a SemVer version into a Debian-style version.
 *
 * Use '~' on pre-releases for proper Debian version ordering.
 * See https://www.debian.org/doc/debian-policy/ch-controlfields.html#s-f-Version
 */
function transformVersion (version) {
  return version.replace(/(\d)[_.+-]?((RC|rc|pre|dev|beta|alpha)[_.+-]?\d*)$/, '$1~$2')
}

/**
 * Get the hash of default options for the installer. Some come from the info
 * read from `package.json`, and some are hardcoded.
 */
function getDefaults (data) {
  return Promise.all([common.readMeta(data), getSize(data.src), common.readElectronVersion(data.src)])
    .then(results => {
      const pkg = results[0] || {}
      const size = results[1] || 0
      const electronVersion = results[2]

      return Object.assign(common.getDefaultsFromPackageJSON(pkg), {
        version: transformVersion(pkg.version || '0.0.0'),

        section: 'utils',
        priority: 'optional',
        size: Math.ceil(size / 1024),

        maintainer: pkg.author && (typeof pkg.author === 'string'
          ? pkg.author.replace(/\s+\([^)]+\)/, '')
          : pkg.author.name +
          (pkg.author.email != null ? ` <${pkg.author.email}>` : '')
        ),

        icon: path.resolve(__dirname, '../resources/icon.png'),
        lintianOverrides: []
      }, debianDependencies.forElectron(electronVersion))
    })
}

/**
 * Sanitize package name per Debian docs:
 * https://www.debian.org/doc/debian-policy/ch-controlfields.html#s-f-source
 */
function sanitizeName (name) {
  const sanitized = common.sanitizeName(name.toLowerCase(), '-+.a-z0-9')
  if (sanitized.length < 2) {
    throw new Error('Package name must be at least two characters')
  }
  if (/^[^a-z0-9]/.test(sanitized)) {
    throw new Error('Package name must start with an ASCII number or letter')
  }

  return sanitized
}

/**
 * Get the hash of options for the installer.
 */
function getOptions (data, defaults) {
  // Flatten everything for ease of use.
  const options = _.defaults({}, data, data.options, defaults)

  options.name = sanitizeName(options.name)

  if (!options.description && !options.productDescription) {
    throw new Error(`No Description or ProductDescription provided. Please set either a description in the app's package.json or provide it in the options.`)
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
      .map(line => wrap(line, { width: 80, indent: ' ' }))
      .join('\n')
  }

  // Create array with unique values from default & user-supplied dependencies
  for (const prop of ['depends', 'recommends', 'suggests', 'enhances', 'preDepends']) {
    options[prop] = common.mergeUserSpecified(data, prop, defaults)
  }

  return options
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

  return fs.ensureDir(path.dirname(controlDest), '0755')
    .then(() => common.generateTemplate(options, controlSrc))
    .then(data => fs.outputFile(controlDest, data))
    .catch(common.wrapError('creating control file'))
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
  })).catch(common.wrapError('creating script files'))
}

function createDesktop (options, dir) {
  const desktopSrc = options.desktopTemplate || path.resolve(__dirname, '../resources/desktop.ejs')
  return common.createDesktop(options, dir, desktopSrc)
}

/**
 * Create lintian overrides for the package.
 */
function createOverrides (options, dir) {
  const overridesSrc = path.resolve(__dirname, '../resources/overrides.ejs')
  const overridesDest = path.join(dir, 'usr/share/lintian/overrides', options.name)
  options.logger(`Creating lintian overrides at ${overridesDest}`)

  return fs.ensureDir(path.dirname(overridesDest), '0755')
    .then(() => common.generateTemplate(options, overridesSrc))
    .then(data => fs.outputFile(overridesDest, data))
    .then(() => fs.chmod(overridesDest, '0644'))
    .catch(common.wrapError('creating lintian overrides file'))
}

/**
 * Copy the application into the package.
 */
function createApplication (options, dir) {
  return common.copyApplication(options, dir, null, src => src !== path.join(options.src, 'LICENSE'))
}

/**
 * Create the contents of the package.
 */
function createContents (options, dir) {
  return common.createContents(options, dir, [
    createControl,
    copyScripts,
    common.createBinary,
    createDesktop,
    common.createIcon,
    common.createCopyright,
    createOverrides,
    createApplication
  ])
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
  const packagePattern = path.join(dir, '../*.deb')
  return common.movePackage(packagePattern, options, dir)
}

/* ************************************************************************** */

module.exports = data => {
  data.rename = data.rename || defaultRename
  data.logger = data.logger || defaultLogger

  let options

  if (process.umask() !== 0o0022 && process.umask() !== 0o0002) {
    console.warn(`The current umask, ${process.umask().toString(8)}, is not supported. You should use 0022 or 0002`)
  }

  return getDefaults(data)
    .then(defaults => getOptions(data, defaults))
    .then(generatedOptions => {
      options = generatedOptions
      return data.logger(`Creating package with options\n${JSON.stringify(options, null, 2)}`)
    }).then(() => common.createDir(options))
    .then(dir => createContents(options, dir))
    .then(dir => createPackage(options, dir))
    .then(dir => movePackage(options, dir))
    .then(() => {
      data.logger(`Successfully created package at ${options.dest}`)
      return options
    }).catch(err => {
      data.logger(common.errorMessage('creating package', err))
      throw err
    })
}

module.exports.transformVersion = transformVersion
