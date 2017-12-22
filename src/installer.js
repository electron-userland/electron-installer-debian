'use strict'

const _ = require('lodash')
const asar = require('asar')
const async = require('async')
const child = require('child_process')
const debug = require('debug')
const fs = require('fs-extra')
const fsize = require('get-folder-size')
const glob = require('glob')
const mkdirp = require('mkdirp')
const path = require('path')
const temp = require('temp').track()
const wrap = require('word-wrap')

const dependencies = require('./dependencies')

const defaultLogger = debug('electron-installer-debian')

const defaultRename = (dest, src) => {
  return path.join(dest, '<%= name %>_<%= version %>_<%= arch %>.deb')
}

/**
 * Spawn a child process.
 */
function spawn (options, command, args, callback) {
  let spawnedProcess = null
  let error = null
  let stderr = ''

  options.logger(`Executing command ${command} ${args.join(' ')}`)

  try {
    spawnedProcess = child.spawn(command, args)
  } catch (err) {
    process.nextTick(() => {
      callback(err, stderr)
    })
    return
  }

  spawnedProcess.stderr.on('data', data => {
    stderr += data
  })

  spawnedProcess.on('error', err => {
    if (err.name === 'ENOENT') {
      const isFakeroot = err.syscall === 'spawn fakeroot'
      const isDpkg = !isFakeroot && err.syscall === 'spawn dpkg'

      if (isFakeroot || isDpkg) {
        const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'
        const pkg = isFakeroot ? 'fakeroot' : 'dpkg'

        err.message = `Your system is missing the fakeroot package. Try, e.g. '${installer} install ${pkg}'`
      }
    }

    error = error || err
  })

  spawnedProcess.on('close', (code, signal) => {
    if (code !== 0) {
      error = error || signal || code
    }

    callback(error && new Error(`Error executing command (${error.message || error}):\n${command} ${args.join(' ')}\n${stderr}`))
  })
}

/**
 * Read `package.json` either from `resources/app.asar` (if the app is packaged)
 * or from `resources/app/package.json` (if it is not).
 */
function readMeta (options, callback) {
  const withAsar = path.join(options.src, 'resources/app.asar')
  const withoutAsar = path.join(options.src, 'resources/app/package.json')

  try {
    fs.accessSync(withAsar)
    options.logger(`Reading package metadata from ${withAsar}`)
    return callback(null, JSON.parse(asar.extractFile(withAsar, 'package.json')))
  } catch (err) {
  }

  try {
    options.logger(`Reading package metadata from ${withoutAsar}`)
    callback(null, fs.readJsonSync(withoutAsar))
  } catch (err) {
    callback(new Error(`Error reading package metadata: ${err.message || err}`))
  }
}

/**
 * Read `LICENSE` from the root of the app.
 */
function readLicense (options, callback) {
  const licenseSrc = path.join(options.src, 'LICENSE')
  options.logger(`Reading license file from ${licenseSrc}`)

  fs.readFile(licenseSrc, callback)
}

/**
 * Get the size of the app.
 */
function getSize (options, callback) {
  fsize(options.src, callback)
}

/**
 * Get the hash of default options for the installer. Some come from the info
 * read from `package.json`, and some are hardcoded.
 */
function getDefaults (data, callback) {
  async.parallel([
    async.apply(readMeta, data),
    async.apply(getSize, {src: data.src}),
    async.apply(dependencies.getTrashDepends, {src: data.src})
  ], (err, results) => {
    const pkg = results[0] || {}
    const size = results[1] || 0
    const trashDependencies = results[2] || 'gvfs-bin'

    const defaults = {
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

    callback(err, defaults)
  })
}

/**
 * Get the hash of options for the installer.
 */
function getOptions (data, defaults, callback) {
  // Flatten everything for ease of use.
  const options = _.defaults({}, data, data.options, defaults)

  if (!options.description && !options.productDescription) {
    return callback(new Error('No Description or ProductDescription provided'))
  }

  if (options.description) {
    // Replace all newlines in the description with spaces, since it's supposed
    // to be one line.
    options.description = options.description.replace(/[\r\n]+/g, ' ')
  }

  if (options.productDescription) {
    // Ensure blank lines have the "." that denotes a blank line in the control file.
    options.productDescription = options.productDescription.replace(/^$/m, '.')
    // Wrap the extended description to avoid lintian warning about
    // `extended-description-line-too-long`.
    options.productDescription = wrap(options.productDescription, {width: 80, indent: ' '})
  }

  // Create array with unique values from default & user-supplied dependencies
  for (const prop of ['depends', 'recommends', 'suggests', 'enhances', 'preDepends']) {
    if (data.options) { // options passed programmatically
      options[prop] = _.union(defaults[prop], data.options[prop])
    } else { // options passed via command-line
      options[prop] = _.union(defaults[prop], data[prop])
    }
  }

  callback(null, options)
}

/**
 * Fill in a template with the hash of options.
 */
function generateTemplate (options, file, callback) {
  options.logger(`Generating template from ${file}`)

  async.waterfall([
    async.apply(fs.readFile, file),
    (template, callback) => {
      const result = _.template(template)(options)
      options.logger(`Generated template from ${file}\n${result}`)
      callback(null, result)
    }
  ], callback)
}

/**
 * Create the control file for the package.
 *
 * See: https://www.debian.org/doc/debian-policy/ch-controlfields.html
 */
function createControl (options, dir, callback) {
  const controlSrc = path.resolve(__dirname, '../resources/control.ejs')
  const controlDest = path.join(dir, 'DEBIAN/control')
  options.logger(`Creating control file at ${controlDest}`)

  async.waterfall([
    async.apply(generateTemplate, options, controlSrc),
    async.apply(fs.outputFile, controlDest)
  ], err => {
    callback(err && new Error(`Error creating control file: ${err.message || err}`))
  })
}

/**
 * Copy debian scripts.
 */
function copyScripts (options, dir, callback) {
  const scriptNames = ['preinst', 'postinst', 'prerm', 'postrm']

  async.forEachOf(options.scripts, (item, key, callback) => {
    if (_.includes(scriptNames, key)) {
      const scriptFile = path.join(dir, 'DEBIAN', key)
      options.logger(`Creating script file at ${scriptFile}`)

      fs.copy(item, scriptFile, callback)
    } else {
      callback(new Error(`Wrong executable script name: ${key}`))
    }
  }, err => {
    callback(err && new Error(`Error creating script files: ${err.message || err}`))
  })
}

/**
 * Create the binary for the package.
 */
function createBinary (options, dir, callback) {
  const binDir = path.join(dir, 'usr/bin')
  const binSrc = path.join('../lib', options.name, options.bin)
  const binDest = path.join(binDir, options.name)
  options.logger(`Symlinking binary from ${binSrc} to ${binDest}`)

  mkdirp(binDir, '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating binary path: ${err.message || err}`))

    fs.symlink(binSrc, binDest, 'file', err => {
      callback(err && new Error(`Error creating binary file: ${err.message || err}`))
    })
  })
}

/**
 * Create the desktop file for the package.
 *
 * See: http://standards.freedesktop.org/desktop-entry-spec/latest/
 */
function createDesktop (options, dir, callback) {
  const desktopSrc = options.desktopTemplate || path.resolve(__dirname, '../resources/desktop.ejs')
  const desktopDest = path.join(dir, 'usr/share/applications', `${options.name}.desktop`)
  options.logger(`Creating desktop file at ${desktopDest}`)

  mkdirp(path.dirname(desktopDest), '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating desktop path: ${err.message || err}`))

    async.waterfall([
      async.apply(generateTemplate, options, desktopSrc),
      async.apply(fs.outputFile, desktopDest),
      async.apply(fs.chmod, desktopDest, '0644')
    ], err => {
      callback(err && new Error(`Error creating desktop file: ${err.message || err}`))
    })
  })
}

/**
 * Create pixmap icon for the package.
 */
function createPixmapIcon (options, dir, callback) {
  const iconFile = path.join(dir, 'usr/share/pixmaps', `${options.name}.png`)
  options.logger(`Creating icon file at ${iconFile}`)

  mkdirp(path.dirname(iconFile), '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating icon path: ${err.message || err}`))

    fs.copy(options.icon, iconFile, err => {
      if (!err) fs.chmod(iconFile, '0644')
      callback(err && new Error(`Error creating icon file: ${err.message || err}`))
    })
  })
}

/**
 * Create hicolor icon for the package.
 */
function createHicolorIcon (options, dir, callback) {
  async.forEachOf(options.icon, (icon, resolution, callback) => {
    const iconExt = resolution === 'scalable' ? 'svg' : 'png'
    const iconFile = path.join(dir, 'usr/share/icons/hicolor', resolution, 'apps', `${options.name}.${iconExt}`)
    options.logger(`Creating icon file at ${iconFile}`)

    mkdirp(path.dirname(iconFile), '0755', (err, made) => {
      if (err) callback(err)

      fs.copy(icon, iconFile, err => {
        if (!err) fs.chmod(iconFile, '0644')
        callback(err)
      })
    })
  }, err => {
    callback(err && new Error(`Error creating icon file: ${err.message || err}`))
  })
}

/**
 * Create icon for the package.
 */
function createIcon (options, dir, callback) {
  if (_.isObject(options.icon)) {
    createHicolorIcon(options, dir, callback)
  } else {
    createPixmapIcon(options, dir, callback)
  }
}

/**
 * Create copyright for the package.
 */
function createCopyright (options, dir, callback) {
  const copyrightFile = path.join(dir, 'usr/share/doc', options.name, 'copyright')
  options.logger(`Creating copyright file at ${copyrightFile}`)

  mkdirp(path.dirname(copyrightFile), '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating copyright path: ${err.message || err}`))

    async.waterfall([
      async.apply(readLicense, options),
      async.apply(fs.outputFile, copyrightFile),
      async.apply(fs.chmod, copyrightFile, '0644')
    ], err => {
      callback(err && new Error(`Error creating copyright file: ${err.message || err}`))
    })
  })
}

/**
 * Create lintian overrides for the package.
 */
function createOverrides (options, dir, callback) {
  const overridesSrc = path.resolve(__dirname, '../resources/overrides.ejs')
  const overridesDest = path.join(dir, 'usr/share/lintian/overrides', options.name)
  options.logger(`Creating lintian overrides at ${overridesDest}`)

  mkdirp(path.dirname(overridesDest), '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating lintian overrides path: ${err.message || err}`))

    async.waterfall([
      async.apply(generateTemplate, options, overridesSrc),
      async.apply(fs.outputFile, overridesDest),
      async.apply(fs.chmod, overridesDest, '0644')
    ], err => {
      callback(err && new Error(`Error creating lintian overrides file: ${err.message || err}`))
    })
  })
}

/**
 * Copy the application into the package.
 */
function createApplication (options, dir, callback) {
  const applicationDir = path.join(dir, 'usr/lib', options.name)
  const licenseFile = path.join(applicationDir, 'LICENSE')
  options.logger(`Copying application to ${applicationDir}`)

  mkdirp(applicationDir, '0755', (err, made) => {
    if (err) callback(err && new Error(`Error creating application directory: ${err.message || err}`))

    async.waterfall([
      async.apply(fs.copy, options.src, applicationDir),
      async.apply(fs.unlink, licenseFile)
    ], err => {
      callback(err && new Error(`Error copying application directory: ${err.message || err}`))
    })
  })
}

/**
 * Create temporary directory where the contents of the package will live.
 */
function createDir (options, callback) {
  options.logger('Creating temporary directory')

  async.waterfall([
    async.apply(temp.mkdir, 'electron-'),
    (dir, callback) => {
      dir = path.join(dir, `${options.name}_${options.version}_${options.arch}`)
      mkdirp(dir, '0755', callback)
    }
  ], (err, dir) => {
    callback(err && new Error(`Error creating temporary directory: ${err.message || err}`), dir)
  })
}

/**
 * Create the contents of the package.
 */
function createContents (options, dir, callback) {
  options.logger('Creating contents of package')

  async.parallel([
    async.apply(createControl, options, dir),
    async.apply(copyScripts, options, dir),
    async.apply(createBinary, options, dir),
    async.apply(createDesktop, options, dir),
    async.apply(createIcon, options, dir),
    async.apply(createCopyright, options, dir),
    async.apply(createOverrides, options, dir),
    async.apply(createApplication, options, dir)
  ], err => {
    callback(err, dir)
  })
}

/**
 * Package everything using `dpkg` and `fakeroot`.
 */
function createPackage (options, dir, callback) {
  options.logger(`Creating package at ${dir}`)

  spawn(options, 'fakeroot', ['dpkg-deb', '--build', dir], err => {
    callback(err, dir)
  })
}

/**
 * Move the package to the specified destination.
 */
function movePackage (options, dir, callback) {
  options.logger('Moving package to destination')

  const packagePattern = path.join(dir, '../*.deb')
  async.waterfall([
    async.apply(glob, packagePattern),
    (files, callback) => {
      async.each(files, file => {
        const template = options.rename(options.dest, path.basename(file))
        const dest = _.template(template)(options)
        options.logger(`Moving file ${file} to ${dest}`)
        fs.move(file, dest, {clobber: true}, callback)
      }, callback)
    }
  ], err => {
    callback(err && new Error(`Error moving package files: ${err.message || err}`), dir)
  })
}

/* ************************************************************************** */

module.exports = (data, callback) => {
  data.rename = data.rename || defaultRename
  data.logger = data.logger || defaultLogger

  async.waterfall([
    async.apply(getDefaults, data),
    async.apply(getOptions, data),
    (options, callback) => {
      data.logger(`Creating package with options\n${JSON.stringify(options, null, 2)}`)
      async.waterfall([
        async.apply(createDir, options),
        async.apply(createContents, options),
        async.apply(createPackage, options),
        async.apply(movePackage, options)
      ], err => {
        callback(err, options)
      })
    }
  ], (err, options) => {
    if (!err) {
      data.logger(`Successfully created package at ${options.dest}`)
    } else {
      data.logger(`Error creating package: ${err.message || err}`)
    }

    callback(err, options)
  })
}
