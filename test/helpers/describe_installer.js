'use strict'

const _ = require('lodash')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const temp = require('temp')

const installer = require('../..')

module.exports = function describeInstaller (description, installerOptions, itDescription, itFunc) {
  describe(description, test => {
    const outputDir = module.exports.tempOutputDir(installerOptions.dest)

    before(done => {
      const options = module.exports.testInstallerOptions(outputDir, installerOptions)

      installer(options, done)
    })

    it(itDescription, done => {
      itFunc(outputDir, done)
    })

    module.exports.cleanupOutputDir(outputDir)
  })
}

module.exports.cleanupOutputDir = function cleanupOutputDir (outputDir) {
  after(done => {
    fs.remove(outputDir, done)
  })
}

module.exports.tempOutputDir = function tempOutputDir (customDir) {
  return customDir ? path.join(os.tmpdir(), customDir) : temp.path({prefix: 'electron-installer-debian-'})
}

module.exports.testInstallerOptions = function testInstallerOptions (outputDir, installerOptions) {
  return _.merge({
    dest: outputDir,
    rename: debFile => {
      return path.join(debFile, '<%= name %>_<%= arch %>.deb')
    },
    options: {
      arch: 'amd64'
    }
  }, installerOptions)
}
