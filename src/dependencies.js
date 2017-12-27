'use strict'

const fs = require('fs-extra')
const path = require('path')
const semver = require('semver')

module.exports = {
  /**
   * Determine the dependencies for the `shell.moveItemToTrash` API, based on the
   * Electron version in use.
   */
  getTrashDepends: function getTrashDepends (options, callback) {
    fs.readFile(path.resolve(options.src, 'version'), (err, tag) => {
      if (err) return callback(err)

      // The content of the version file is the tag name, e.g. "v1.8.1"
      const version = tag.toString().slice(1).trim()
      if (semver.lt(version, '1.4.1')) {
        return callback(null, 'gvfs-bin')
      } else if (semver.lt(version, '1.7.2')) {
        return callback(null, 'kde-cli-tools | kde-runtime | trash-cli | gvfs-bin')
      } else {
        return callback(null, 'kde-cli-tools | kde-runtime | trash-cli | libglib2.0-bin | gvfs-bin')
      }
    })
  },

  /**
   * Determine the default dependencies for an Electron application.
   */
  getDepends: function getDepends (trashDependencies) {
    return [
      trashDependencies,
      'libgconf2-4',
      'libgtk2.0-0',
      'libnotify4',
      'libnss3',
      'libxtst6',
      'xdg-utils'
    ]
  }
}
