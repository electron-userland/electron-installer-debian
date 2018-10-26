'use strict'

const chai = require('chai')
const { exec } = require('mz/child_process')
const fs = require('fs-extra')
const path = require('path')

const installer = require('..')

const access = require('./helpers/access')
const dependencies = require('./helpers/dependencies')
const describeInstaller = require('./helpers/describe_installer')
const cleanupOutputDir = describeInstaller.cleanupOutputDir
const tempOutputDir = describeInstaller.tempOutputDir
const testInstallerOptions = describeInstaller.testInstallerOptions

const assertASARDebExists = outputDir =>
  access(path.join(outputDir, 'footest_i386.deb'))

const assertNonASARDebExists = outputDir =>
  access(path.join(outputDir, 'bartest_amd64.deb'))

describe('module', function () {
  this.timeout(30000)

  describeInstaller(
    'with an app with asar',
    {
      src: 'test/fixtures/app-with-asar/',
      options: {
        productDescription: 'Just a test.',
        section: 'devel',
        priority: 'optional',
        arch: 'i386',
        recommends: [],
        suggests: [],
        categories: []
      }
    },
    'generates a .deb package',
    assertASARDebExists
  )

  describeInstaller(
    'with an app without asar',
    {
      src: 'test/fixtures/app-without-asar/',
      options: {
        icon: {
          '1024x1024': 'test/fixtures/icon.png',
          'scalable': 'test/fixtures/icon.svg'
        },
        bin: 'resources/cli/bar.sh',
        productDescription: 'Just a test.',
        section: 'devel',
        priority: 'optional',
        depends: [],
        recommends: [],
        suggests: [],
        categories: [
          'Utility'
        ],
        mimeType: [
          'text/plain'
        ],
        lintianOverrides: [
          'changelog-file-missing-in-native-package',
          'executable-not-elf-or-script'
        ]
      }
    },
    'generates a .deb package',
    assertNonASARDebExists
  )

  describeInstaller(
    'with an app with a multi-line description',
    {
      src: 'test/fixtures/app-without-asar/',
      options: {
        description: 'Line one\nLine 2\rLine3\r\nLine 4'
      }
    },
    'generates a .deb package',
    assertNonASARDebExists
  )

  describeInstaller(
    'with an app with a multi-line productDescription',
    {
      src: 'test/fixtures/app-without-asar/',
      options: {
        productDescription: 'Line one:\r\n *Line 2\n\nLine3\nLine 4'
      }
    },
    'generates a .deb package',
    assertNonASARDebExists
  )

  describeInstaller(
    'with an app with a productDescription containing a blank line',
    {
      src: 'test/fixtures/app-without-asar/',
      options: {
        productDescription: 'Line one\n\nLine 2 after a blank line'
      }
    },
    'generates a .deb package',
    assertNonASARDebExists
  )

  describeInstaller(
    'with a custom desktop template',
    {
      src: 'test/fixtures/app-without-asar/',
      options: {
        desktopTemplate: 'test/fixtures/custom.desktop.ejs'
      }
    },
    'generates a custom `.desktop` file',
    outputDir =>
      assertNonASARDebExists(outputDir)
        .then(() => exec('dpkg-deb -x bartest_amd64.deb .', { cwd: outputDir }))
        .then(() => fs.readFile(path.join(outputDir, 'usr/share/applications/bartest.desktop')))
        .then(data => {
          if (!data.toString().includes('Comment=Hardcoded comment')) {
            throw new Error('Did not use custom template')
          }
          return Promise.resolve()
        })
  )

  describe('with no description or productDescription provided', test => {
    const outputDir = tempOutputDir()
    cleanupOutputDir(outputDir)

    it('throws an error', () => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-without-description-or-product-description/'
      })
      return installer(installerOptions)
        .catch(error => chai.expect(error.message).to.match(/^No Description or ProductDescription provided/))
    })
  })

  describeInstaller(
    'with debian scripts and lintian overrides',
    {
      src: 'test/fixtures/app-with-asar/',
      options: {
        productDescription: 'Just a test.',
        arch: 'i386',
        scripts: {
          preinst: 'test/fixtures/debian-scripts/preinst.sh',
          postinst: 'test/fixtures/debian-scripts/postinst.sh',
          prerm: 'test/fixtures/debian-scripts/prerm.sh',
          postrm: 'test/fixtures/debian-scripts/postrm.sh'
        },
        lintianOverrides: [
          'binary-without-manpage',
          'debian-changelog-file-missing',
          'executable-not-elf-or-script'
        ]
      }
    },
    'passes lintian checks',
    outputDir =>
      assertASARDebExists(outputDir)
        .then(() => exec(`lintian ${path.join(outputDir, 'footest_i386.deb')}`))
        .then(stdout => {
          const lineCount = stdout.toString().match(/\n/g).length
          if (lineCount > 1) {
            throw new Error('Warnings not overriding:\n' + stdout.toString())
          }
          return Promise.resolve()
        })
  )

  describe('unknown script name', test => {
    const outputDir = tempOutputDir()
    cleanupOutputDir(outputDir)

    it('throws an error', () => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-with-asar/',
        scripts: {
          invalid: 'test/fixtures/debian-scripts/preinst.sh'
        }
      })
      return installer(installerOptions)
        .catch(error => chai.expect(error.message).to.deep.equal('Wrong executable script name: invalid'))
    })
  })

  describe('with duplicate dependencies', test => {
    const outputDir = tempOutputDir()

    // User options with duplicates (including default duplicates)
    const userDependencies = {
      depends: ['libnss3', 'libxtst6', 'dbus', 'dbus'],
      recommends: ['pulseaudio | libasound2', 'bzip2', 'bzip2'],
      suggests: ['lsb-release', 'gvfs', 'gvfs'],
      enhances: ['libc6', 'libc6'],
      preDepends: ['footest', 'footest']
    }

    before(() => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-with-asar/',
        options: Object.assign({ arch: 'i386' }, userDependencies)
      })
      return installer(installerOptions)
    })

    cleanupOutputDir(outputDir)

    it('removes duplicate dependencies', () =>
      assertASARDebExists(outputDir)
        .then(() => dependencies.assertDependenciesEqual(outputDir, 'footest_i386.deb', userDependencies))
    )
  })

  describe('with restrictive umask', test => {
    const outputDir = tempOutputDir()
    let defaultMask
    let consoleWarn
    let warning = ''

    before(() => {
      defaultMask = process.umask(0o777)
      consoleWarn = console.warn
      console.warn = msg => {
        warning += msg
      }
    })

    it(`warns the user about umasks`, () => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-with-asar/',
        options: { arch: 'i386' }
      })
      return installer(installerOptions)
        .catch(() => chai.expect(warning).to.contain(`The current umask, ${process.umask().toString(8)}, is not supported. You should use 0022 or 0002`))
    })

    cleanupOutputDir(outputDir)

    after(() => {
      console.warn = consoleWarn
      process.umask(defaultMask)
    })
  })

  describe('transformVersion', () => {
    it('uses tildes for pre-release versions', () => {
      chai.expect(installer.transformVersion('1.2.3')).to.equal('1.2.3')
      chai.expect(installer.transformVersion('1.2.3-beta.4')).to.equal('1.2.3~beta.4')
    })
  })
})
