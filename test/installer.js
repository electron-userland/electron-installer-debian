'use strict'

const chai = require('chai')
const path = require('path')
const { spawn } = require('@malept/cross-spawn-promise')

const installer = require('..')

const access = require('./helpers/access')
const describeInstaller = require('./helpers/describe_installer')
const { cleanupOutputDir, describeInstallerWithException, tempOutputDir, testInstallerOptions } = require('./helpers/describe_installer')

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
          scalable: 'test/fixtures/icon.svg'
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

  describeInstallerWithException(
    'with a too-short name',
    {
      name: 'a',
      src: 'test/fixtures/app-with-asar'
    },
    /^Package name must be at least two characters$/
  )

  describeInstallerWithException(
    'with a name that does not start with an alphanumeric character',
    {
      name: '-package',
      src: 'test/fixtures/app-with-asar'
    },
    /^Package name must start with an ASCII number or letter$/
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

  describeInstallerWithException(
    'with no description or productDescription provided',
    { src: 'test/fixtures/app-without-description-or-product-description/' },
    /^No Description or ProductDescription provided/
  )

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
          'changelog-file-missing-in-native-package',
          'executable-not-elf-or-script'
        ]
      }
    },
    'passes lintian checks',
    async outputDir => {
      await assertASARDebExists(outputDir)
      try {
        await spawn('lintian', [path.join(outputDir, 'footest_i386.deb')], {
          updateErrorCallback: (err) => {
            if (err.code === 'ENOENT' && err.syscall === 'spawn lintian') {
              err.message = 'Your system is missing the lintian package'
            }
          }
        })
      } catch (err) {
        if (!err.stdout) {
          throw err
        }
        const stdout = err.stdout.toString()
        const lineCount = stdout.match(/\n/g).length
        if (lineCount > 1) {
          throw new Error(`Warnings not overriding:\n${stdout}`)
        }
      }
    }
  )

  describeInstallerWithException(
    'unknown script name',
    {
      src: 'test/fixtures/app-with-asar/',
      scripts: {
        invalid: 'test/fixtures/debian-scripts/preinst.sh'
      }
    },
    /^Wrong executable script name: invalid$/
  )

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

    it('warns the user about umasks', () => {
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
