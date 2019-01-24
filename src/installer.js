'use strict'

const _ = require('lodash')
const common = require('electron-installer-common')
const debug = require('debug')
const fs = require('fs-extra')
const fsize = require('get-folder-size')
const parseAuthor = require('parse-author')
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
 * Transforms a SemVer version into a Debian-style version.
 *
 * Use '~' on pre-releases for proper Debian version ordering.
 * See https://www.debian.org/doc/debian-policy/ch-controlfields.html#s-f-Version
 */
function transformVersion (version) {
  return version.replace(/(\d)[_.+-]?((RC|rc|pre|dev|beta|alpha)[_.+-]?\d*)$/, '$1~$2')
}

class DebianInstaller extends common.ElectronInstaller {
  get contentFunctions () {
    return [
      'copyApplication',
      'copyLinuxIcons',
      'copyScripts',
      'createBinarySymlink',
      'createControl',
      'createCopyright',
      'createDesktopFile',
      'createOverrides'
    ]
  }

  get defaultDesktopTemplatePath () {
    return path.resolve(__dirname, '../resources/desktop.ejs')
  }

  get packagePattern () {
    return path.join(this.stagingDir, '../*.deb')
  }

  /**
   * Copy the application into the package.
   */
  copyApplication () {
    return super.copyApplication(src => src !== path.join(this.options.src, 'LICENSE'))
  }

  /**
   * Copy debian scripts.
   */
  copyScripts () {
    const scriptNames = ['preinst', 'postinst', 'prerm', 'postrm']

    return Promise.all(_.map(this.options.scripts, (item, key) => {
      if (_.includes(scriptNames, key)) {
        const scriptFile = path.join(this.stagingDir, 'DEBIAN', key)
        this.options.logger(`Creating script file at ${scriptFile}`)

        return fs.copy(item, scriptFile)
      } else {
        throw new Error(`Wrong executable script name: ${key}`)
      }
    })).catch(common.wrapError('creating script files'))
  }

  /**
   * Creates the control file for the package.
   *
   * See: https://www.debian.org/doc/debian-policy/ch-controlfields.html
   */
  createControl () {
    const src = path.resolve(__dirname, '../resources/control.ejs')
    const dest = path.join(this.stagingDir, 'DEBIAN', 'control')
    this.options.logger(`Creating control file at ${dest}`)

    return this.createTemplatedFile(src, dest)
      .catch(common.wrapError('creating control file'))
  }

  /**
   * Create lintian overrides for the package.
   */
  createOverrides () {
    const src = path.resolve(__dirname, '../resources/overrides.ejs')
    const dest = path.join(this.stagingDir, this.baseAppDir, 'share/lintian/overrides', this.options.name)
    this.options.logger(`Creating lintian overrides at ${dest}`)

    return this.createTemplatedFile(src, dest, '0644')
      .catch(common.wrapError('creating lintian overrides file'))
  }

  /**
   * Package everything using `dpkg` and `fakeroot`.
   */
  createPackage () {
    this.options.logger(`Creating package at ${this.stagingDir}`)

    return spawn('fakeroot', ['dpkg-deb', '--build', this.stagingDir], this.options.logger)
      .then(output => this.options.logger(`dpkg-deb output: ${output}`))
  }

  /**
   * Get the hash of default options for the installer. Some come from the info
   * read from `package.json`, and some are hardcoded.
   */
  generateDefaults () {
    return Promise.all([
      common.readMetadata(this.userSupplied),
      this.getSize(this.userSupplied.src),
      common.readElectronVersion(this.userSupplied.src)
    ]).then(([pkg, size, electronVersion]) => {
      pkg = pkg || {}

      this.defaults = Object.assign(common.getDefaultsFromPackageJSON(pkg), {
        version: transformVersion(pkg.version || '0.0.0'),

        section: 'utils',
        priority: 'optional',
        size: Math.ceil((size || 0) / 1024),

        maintainer: this.getMaintainer(pkg.author),

        icon: path.resolve(__dirname, '../resources/icon.png'),
        lintianOverrides: []
      }, debianDependencies.forElectron(electronVersion))

      return this.defaults
    })
  }

  /**
   * Flattens and merges default values, CLI-supplied options, and API-supplied options.
   */
  generateOptions () {
    super.generateOptions()

    this.options.name = this.sanitizeName(this.options.name)

    if (!this.options.description && !this.options.productDescription) {
      throw new Error(`No Description or ProductDescription provided. Please set either a description in the app's package.json or provide it in the this.options.`)
    }

    if (this.options.description) {
      this.options.description = this.normalizeDescription(this.options.description)
    }

    if (this.options.productDescription) {
      this.options.productDescription = this.normalizeExtendedDescription(this.options.productDescription)
    }

    // Create array with unique values from default & user-supplied dependencies
    for (const prop of ['depends', 'recommends', 'suggests', 'enhances', 'preDepends']) {
      this.options[prop] = common.mergeUserSpecified(this.userSupplied, prop, this.defaults)
    }

    return this.options
  }

  /**
   * Generates a Debian-compliant maintainer value from a package.json author field.
   */
  getMaintainer (author) {
    if (author) {
      if (typeof author === 'string') {
        author = parseAuthor(author)
      }
      const maintainer = [author.name]
      if (author.email) {
        maintainer.push(`<${author.email}>`)
      }

      return maintainer.join(' ')
    }
  }

  /**
   * Get the size of the app.
   */
  getSize (appDir) {
    return pify(fsize)(appDir)
  }

  /**
   * Normalize the description by replacing all newlines in the description with spaces, since it's
   * supposed to be one line.
   */
  normalizeDescription (description) {
    return description.replace(/[\r\n]+/g, ' ')
  }

  /**
   * Ensure blank lines have the "." that denotes a blank line in the control file. Wrap any
   * extended description lines to avoid lintian warnings about
   * `extended-description-line-too-long`.
   */
  normalizeExtendedDescription (extendedDescription) {
    return extendedDescription
      .replace(/\r\n/g, '\n') // Fixes errors when finding blank lines in Windows
      .replace(/^$/mg, '.')
      .split('\n')
      .map(line => wrap(line, { width: 80, indent: ' ' }))
      .join('\n')
  }

  /**
   * Sanitize package name per Debian docs:
   * https://www.debian.org/doc/debian-policy/ch-controlfields.html#s-f-source
   */
  sanitizeName (name) {
    const sanitized = common.sanitizeName(name.toLowerCase(), '-+.a-z0-9')
    if (sanitized.length < 2) {
      throw new Error('Package name must be at least two characters')
    }
    if (/^[^a-z0-9]/.test(sanitized)) {
      throw new Error('Package name must start with an ASCII number or letter')
    }

    return sanitized
  }
}

/* ************************************************************************** */

module.exports = data => {
  data.rename = data.rename || defaultRename
  data.logger = data.logger || defaultLogger

  if (process.umask() !== 0o0022 && process.umask() !== 0o0002) {
    console.warn(`The current umask, ${process.umask().toString(8)}, is not supported. You should use 0022 or 0002`)
  }

  const installer = new DebianInstaller(data)

  return installer.generateDefaults()
    .then(() => installer.generateOptions())
    .then(() => data.logger(`Creating package with options\n${JSON.stringify(installer.options, null, 2)}`))
    .then(() => installer.createStagingDir())
    .then(() => installer.createContents())
    .then(() => installer.createPackage())
    .then(() => installer.movePackage())
    .then(() => {
      data.logger(`Successfully created package at ${installer.options.dest}`)
      return installer.options
    }).catch(err => {
      data.logger(common.errorMessage('creating package', err))
      throw err
    })
}

module.exports.Installer = DebianInstaller
module.exports.transformVersion = transformVersion
