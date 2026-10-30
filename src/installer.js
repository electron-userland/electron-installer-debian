import common from 'electron-installer-common'
import debug from 'debug'
import fs from 'node:fs/promises'
import parseAuthor from 'parse-author'
import path from 'node:path'
import wrap from 'word-wrap'

import debianDependencies from './dependencies.js'
import spawn from './spawn.js'

const defaultLogger = debug('electron-installer-debian')

const defaultRename = dest => {
  return path.join(dest, '<%= name %>_<%= version %><% if (revision) { %>-<%= revision %><% } %>_<%= arch %>.deb')
}

/**
 * Computes the total size in bytes of a folder, counting hard-linked files
 * only once. Like the `get-folder-size` module it replaces, it includes the
 * sizes of the directory entries themselves and does not follow symlinks.
 */
async function getFolderSize (folder) {
  const folderStats = await fs.lstat(folder)
  if (!folderStats.isDirectory()) {
    return folderStats.size
  }

  let total = folderStats.size
  const seenInodes = new Set([`${folderStats.dev}:${folderStats.ino}`])
  for (const entry of await fs.readdir(folder, { withFileTypes: true, recursive: true })) {
    const stats = await fs.lstat(path.join(entry.parentPath, entry.name))
    const inode = `${stats.dev}:${stats.ino}`
    if (!seenInodes.has(inode)) {
      seenInodes.add(inode)
      total += stats.size
    }
  }

  return total
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
 * Recursively ensures every directory at or under `directory` has the given
 * permissions. Files are left untouched so that data files aren't made
 * executable.
 *
 * `dpkg-deb --build` rejects a control directory whose permissions are below
 * 0755 ("control directory has bad permissions 756 (must be >=0755)"), which
 * happens under restrictive umasks such as those used by some CI environments
 * (e.g. GitHub Codespaces).
 */
async function setDirectoryPermissions (directory, mode) {
  await fs.chmod(directory, mode)
  for (const entry of await fs.readdir(directory, { withFileTypes: true, recursive: true })) {
    if (entry.isDirectory()) {
      await fs.chmod(path.join(entry.parentPath, entry.name), mode)
    }
  }
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
    return path.resolve(import.meta.dirname, '../resources/desktop.ejs')
  }

  get packagePattern () {
    return path.join(this.stagingDir, '../*.deb')
  }

  /**
   * Copy the application into the package.
   */
  async copyApplication () {
    await super.copyApplication(src => src !== path.join(this.options.src, 'LICENSE'))
    return this.updateSandboxHelperPermissions()
  }

  /**
   * Copy debian scripts.
   */
  copyScripts () {
    const scriptNames = ['preinst', 'postinst', 'prerm', 'postrm']

    return common.wrapError('creating script files', async () => {
      const scripts = Object.entries(this.options.scripts || {})
      const invalid = scripts.find(([key]) => !scriptNames.includes(key))
      if (invalid) {
        throw new Error(`Wrong executable script name: ${invalid[0]}`)
      }

      await fs.mkdir(path.join(this.stagingDir, 'DEBIAN'), { recursive: true })

      return Promise.all(scripts.map(async ([key, item]) => {
        const scriptFile = path.join(this.stagingDir, 'DEBIAN', key)
        this.options.logger(`Creating script file at ${scriptFile}`)

        await fs.copyFile(item, scriptFile)
        return fs.chmod(scriptFile, 0o755)
      }))
    })
  }

  /**
   * Creates the control file for the package.
   *
   * See: https://www.debian.org/doc/debian-policy/ch-controlfields.html
   */
  createControl () {
    const src = path.resolve(import.meta.dirname, '../resources/control.ejs')
    const dest = path.join(this.stagingDir, 'DEBIAN', 'control')
    this.options.logger(`Creating control file at ${dest}`)

    return common.wrapError('creating control file', async () => this.createTemplatedFile(src, dest))
  }

  /**
   * Create lintian overrides for the package.
   */
  async createOverrides () {
    const src = path.resolve(import.meta.dirname, '../resources/overrides.ejs')
    const dest = path.join(this.stagingDir, this.baseAppDir, 'share/lintian/overrides', this.options.name)
    this.options.logger(`Creating lintian overrides at ${dest}`)

    return common.wrapError('creating lintian overrides file', async () => this.createTemplatedFile(src, dest, '0644'))
  }

  /**
   * Package everything using `dpkg-deb`.
   */
  async createPackage () {
    this.options.logger(`Creating package at ${this.stagingDir}`)

    await setDirectoryPermissions(this.stagingDir, 0o755)

    const command = ['--root-owner-group', '--build', this.stagingDir]
    if (this.options.compression) {
      command.unshift(`-Z${this.options.compression}`)
    }

    const output = await spawn('dpkg-deb', command, this.options.logger)
    this.options.logger(`dpkg-deb output: ${output}`)
  }

  /**
   * Get the hash of default options for the installer. Some come from the info
   * read from `package.json`, and some are hardcoded.
   */
  async generateDefaults () {
    const [pkg, size, electronVersion] = await Promise.all([
      (async () => (await common.readMetadata(this.userSupplied)) || {})(),
      getFolderSize(this.userSupplied.src),
      common.readElectronVersion(this.userSupplied.src)
    ])

    this.defaults = Object.assign(common.getDefaultsFromPackageJSON(pkg), {
      version: transformVersion(pkg.version || '0.0.0'),

      section: 'utils',
      priority: 'optional',
      compression: 'xz',
      size: Math.ceil((size || 0) / 1024),

      maintainer: this.getMaintainer(pkg.author),

      icon: path.resolve(import.meta.dirname, '../resources/icon.png'),
      lintianOverrides: []
    }, debianDependencies.forElectron(electronVersion))

    return this.defaults
  }

  /**
   * Flattens and merges default values, CLI-supplied options, and API-supplied options.
   */
  generateOptions () {
    super.generateOptions()

    this.options.name = this.sanitizeName(this.options.name)

    if (!this.options.description && !this.options.productDescription) {
      throw new Error("No Description or ProductDescription provided. Please set either a description in the app's package.json or provide it in the this.options.")
    }

    if (this.options.description) {
      this.options.description = this.normalizeDescription(this.options.description)
    }

    if (this.options.productDescription) {
      this.options.productDescription = this.normalizeExtendedDescription(this.options.productDescription)
    }

    const compressionTypes = ['xz', 'gzip', 'bzip2', 'lzma', 'zstd', 'none']
    if (this.options.compression && !compressionTypes.includes(this.options.compression)) {
      throw new Error('Invalid compression type. xz, gzip, bzip2, lzma, zstd, or none are supported.')
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

export default async function createDebianInstaller (data) {
  data.rename = data.rename || defaultRename
  data.logger = data.logger || defaultLogger

  if (process.umask() !== 0o0022 && process.umask() !== 0o0002) {
    console.warn(`The current umask, ${process.umask().toString(8)}, is not supported. You should use 0022 or 0002`)
  }

  const installer = new DebianInstaller(data)

  await installer.generateDefaults()
  await installer.generateOptions()
  data.logger(`Creating package with options\n${JSON.stringify(installer.options, null, 2)}`)
  await installer.createStagingDir()
  await installer.createContents()
  await installer.createPackage()
  await installer.movePackage()
  data.logger(`Successfully created package at ${installer.options.dest}`)
  return installer.options
}

export { DebianInstaller as Installer, setDirectoryPermissions, transformVersion }
