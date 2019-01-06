'use strict'

const _ = require('lodash')
const { expect } = require('chai')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const tmp = require('tmp-promise')

const installer = require('../..')

module.exports = function describeInstaller (description, installerOptions, itDescription, itFunc) {
  describe(description, test => {
    const outputDir = module.exports.tempOutputDir(installerOptions.dest)
    const options = module.exports.testInstallerOptions(outputDir, installerOptions)

    before(() => installer(options))

    it(itDescription, () => itFunc(outputDir))

    module.exports.cleanupOutputDir(outputDir)
  })
}

module.exports.describeInstallerWithException = function describeInstallerWithException (description, installerOptions, errorRegex) {
  describe(description, () => {
    const outputDir = module.exports.tempOutputDir()
    module.exports.cleanupOutputDir(outputDir)

    it('throws an error', () => {
      const options = module.exports.testInstallerOptions(outputDir, installerOptions)
      return installer(options)
        .catch(error => expect(error.message).to.match(errorRegex))
    })
  })
}

module.exports.cleanupOutputDir = function cleanupOutputDir (outputDir) {
  after(() => fs.remove(outputDir))
}

module.exports.tempOutputDir = function tempOutputDir (customDir) {
  return customDir ? path.join(os.tmpdir(), customDir) : tmp.tmpNameSync({ prefix: 'electron-installer-debian-' })
}

module.exports.testInstallerOptions = function testInstallerOptions (outputDir, installerOptions) {
  return _.merge({
    rename: debFile => {
      return path.join(debFile, '<%= name %>_<%= arch %>.deb')
    },
    options: {
      arch: 'amd64'
    }
  }, installerOptions, { dest: outputDir })
}
