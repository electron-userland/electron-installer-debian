'use strict'

const fs = require('fs-extra')
const path = require('path')
const semver = require('semver')

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

module.exports = {
  getElectronVersion: function getElectronVersion (options) {
    return fs.readFile(path.resolve(options.src, 'version'))
      // The content of the version file is the tag name, e.g. "v1.8.1"
      .then(tag => tag.toString().slice(1).trim())
  },
  getGTKDepends: getGTKDepends,
  getTrashDepends: getTrashDepends,

  /**
   * Determine the default dependencies for an Electron application.
   */
  getDepends: function getDepends (version) {
    return [
      getTrashDepends(version),
      'libgconf2-4',
      getGTKDepends(version),
      'libnotify4',
      'libnss3',
      'libxtst6',
      'xdg-utils'
    ]
  }
}
