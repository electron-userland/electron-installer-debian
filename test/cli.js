'use strict'

const fs = require('fs-extra')
const path = require('path')

const access = require('./helpers/access')
const dependencies = require('./helpers/dependencies')
const describeInstaller = require('./helpers/describe_installer')
const spawn = require('../src/spawn')

const cleanupOutputDir = describeInstaller.cleanupOutputDir
const tempOutputDir = describeInstaller.tempOutputDir

function runCLI (options) {
  const args = [
    '--src', options.src,
    '--dest', options.dest,
    '--arch', options.arch
  ]
  if (options.config) args.push('--config', options.config)

  before(done => spawn('./src/cli.js', args, null, done))
}

describe('cli', function () {
  this.timeout(10000)

  describe('with an app with asar', test => {
    const outputDir = tempOutputDir()

    runCLI({ src: 'test/fixtures/app-with-asar/', dest: outputDir, arch: 'i386' })

    it('generates a `.deb` package', done => {
      access(path.join(outputDir, 'footest_0.0.1_i386.deb'), done)
    })

    cleanupOutputDir(outputDir)
  })

  describe('with an app without asar', test => {
    const outputDir = tempOutputDir()

    runCLI({ src: 'test/fixtures/app-without-asar/', dest: outputDir, arch: 'amd64' })

    it('generates a `.deb` package', done => {
      access(path.join(outputDir, 'bartest_0.0.1_amd64.deb'), done)
    })

    cleanupOutputDir(outputDir)
  })

  describe('with duplicate dependencies', function (test) {
    const outputDir = tempOutputDir()
    const config = 'test/fixtures/config.json'

    runCLI({ src: 'test/fixtures/app-with-asar/', dest: outputDir, arch: 'i386', config: config })

    it('removes duplicate dependencies', done => {
      access(path.join(outputDir, 'footest_0.0.1_i386.deb'), () => {
        // object with both user and default dependencies based on src/installer.js
        fs.readJson(config, (err, configObj) => {
          if (err) return done(err)
          dependencies.assertDependenciesEqual(outputDir, 'footest_0.0.1_i386.deb', configObj, done)
        })
      })
    })

    cleanupOutputDir(outputDir)
  })
})
