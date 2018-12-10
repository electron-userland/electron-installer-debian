'use strict'

const fs = require('fs-extra')
const path = require('path')
const semver = require('semver')

/**
 * Determine whether GConf is a necessary dependency, given the Electron version.
 */
function getGConfDepends (version) {
  return semver.lt(version, '3.0.0-beta.1') ? ['libgconf2-4'] : []
}

/**
 * Determine the GTK dependency based on the Electron version in use.
 */
function getGTKDepends (version) {
  return semver.gte(version, '2.0.0-beta.1') ? 'libgtk-3-0' : 'libgtk2.0-0'
}

/**
 * Determine the dependencies for the `shell.moveItemToTrash` API, based on the
 * Electron version in use.
 */
function getTrashDepends (version) {
  if (semver.lt(version, '1.4.1')) {
    return 'gvfs-bin'
  } else if (semver.lt(version, '1.7.2')) {
    return 'kde-cli-tools | kde-runtime | trash-cli | gvfs-bin'
  } else {
    return 'kde-cli-tools | kde-runtime | trash-cli | libglib2.0-bin | gvfs-bin'
  }
}

/**
 * Determine whether libuuid1 is necessary, given the Electron version.
 */
function getUUIDDepends (version) {
  return semver.gte(version, '4.0.0-beta.1') ? ['libuuid1'] : []
}

module.exports = {
  getElectronVersion: function getElectronVersion (options) {
    return fs.readFile(path.resolve(options.src, 'version'))
      // The content of the version file pre-4.0 is the tag name, e.g. "v1.8.1"
      // The content of the version file post-4.0 is just the version
      .then(tag => tag.toString().trim())
  },
  getGConfDepends: getGConfDepends,
  getGTKDepends: getGTKDepends,
  getTrashDepends: getTrashDepends,
  getUUIDDepends: getUUIDDepends,

  /**
   * Determine the default dependencies for an Electron application.
   */
  getDepends: function getDepends (version) {
    return [
      getTrashDepends(version),
      getGTKDepends(version),
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils'
    ].concat(getGConfDepends(version))
      .concat(getUUIDDepends(version))
  }
}
