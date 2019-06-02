'use strict'

const access = require('./helpers/access')
const { cleanupOutputDir, tempOutputDir } = require('./helpers/describe_installer')
const path = require('path')
const spawn = require('../src/spawn')

function runCLI (options) {
  const args = [
    '--src', options.src,
    '--dest', options.dest,
    '--arch', options.arch
  ]
  if (options.config) args.push('--config', options.config)

  before(() => spawn('./src/cli.js', args))
}

describe('cli', function () {
  this.timeout(10000)

  describe('with an app with asar', test => {
    const outputDir = tempOutputDir()

    runCLI({ src: 'test/fixtures/app-with-asar/', dest: outputDir, arch: 'i386', config: 'test/fixtures/config.json' })

    it('generates a `.deb` package', () => access(path.join(outputDir, 'footest_0.0.1-2_i386.deb')))

    cleanupOutputDir(outputDir)
  })

  describe('with an app without asar', test => {
    const outputDir = tempOutputDir()

    runCLI({ src: 'test/fixtures/app-without-asar/', dest: outputDir, arch: 'amd64' })

    it('generates a `.deb` package', () => access(path.join(outputDir, 'bartest_0.0.1_amd64.deb')))

    cleanupOutputDir(outputDir)
  })
})
