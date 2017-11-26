'use strict'

const _ = require('lodash')
const chai = require('chai')
const child = require('child_process')
const fs = require('fs-extra')
const path = require('path')

const dependencies = require('../src/dependencies')
const installer = require('..')

const access = require('./helpers/access')
const describeInstaller = require('./helpers/describe_installer')
const cleanupOutputDir = describeInstaller.cleanupOutputDir
const tempOutputDir = describeInstaller.tempOutputDir
const testInstallerOptions = describeInstaller.testInstallerOptions

const assertASARDebExists = (outputDir, done) => {
  access(path.join(outputDir, 'footest_i386.deb'), done)
}

const assertNonASARDebExists = (outputDir, done) => {
  access(path.join(outputDir, 'bartest_amd64.deb'), done)
}

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
    (outputDir, done) => {
      assertNonASARDebExists(outputDir, () => {
        child.exec('dpkg-deb -x bartest_amd64.deb .', { cwd: outputDir }, (err, stdout, stderr) => {
          if (err) return done(err)
          if (stderr) return done(new Error(stderr.toString()))

          const desktopFile = path.join(outputDir, 'usr/share/applications/bartest.desktop')
          fs.readFile(desktopFile, (err, data) => {
            if (err) return done(err)

            if (data.toString().indexOf('Comment=Hardcoded comment') === -1) {
              done(new Error('Did not use custom template'))
            } else {
              done()
            }
          })
        })
      })
    }
  )

  describe('with no description or productDescription provided', test => {
    const outputDir = tempOutputDir()
    cleanupOutputDir(outputDir)

    it('throws an error', done => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-without-description-or-product-description/'
      })
      installer(installerOptions, error => {
        chai.expect(error.message).to.deep.equal('No Description or ProductDescription provided')
        done()
      })
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
    (outputDir, done) => {
      assertASARDebExists(outputDir, function () {
        child.exec(`lintian ${path.join(outputDir, 'footest_i386.deb')}`, (err, stdout, stderr) => {
          if (err) return done(new Error(err + stdout))

          const lineCount = stdout.match(/\n/g).length
          if (lineCount > 1) {
            done(new Error('Warnings not overriding:\n' + stdout))
          } else {
            done()
          }
        })
      })
    }
  )

  describe('with duplicate dependencies', test => {
    const outputDir = tempOutputDir()

    // User options with duplicates (including default duplicates)
    const depends = ['libnss3', 'libxtst6', 'dbus', 'dbus']
    const recommends = ['pulseaudio | libasound2', 'bzip2', 'bzip2']
    const suggests = ['lsb-release', 'gvfs', 'gvfs']
    const enhances = ['libc6', 'libc6']
    const preDepends = ['footest', 'footest']

    before(done => {
      const installerOptions = testInstallerOptions(outputDir, {
        src: 'test/fixtures/app-with-asar/',
        options: {
          arch: 'i386',
          depends: depends,
          recommends: recommends,
          suggests: suggests,
          enhances: enhances,
          preDepends: preDepends
        }
      })
      installer(installerOptions, done)
    })

    cleanupOutputDir(outputDir)

    it('removes duplicate dependencies', done => {
      assertASARDebExists(outputDir, () => {
        const dpkgDebCmd = 'dpkg-deb -f footest_i386.deb ' +
          'Depends Recommends Suggests Enhances Pre-Depends'
        child.exec(dpkgDebCmd, { cwd: outputDir }, function (err, stdout, stderr) {
          if (err) return done(err)
          if (stderr) return done(new Error(stderr.toString()))

          const baseDependencies = {
            Depends: _.sortBy(_.union(dependencies.getDepends('gvfs-bin'), depends)),
            Recommends: _.sortBy(_.union(['pulseaudio | libasound2'], recommends)),
            Suggests: _.sortBy(_.union([
              'gir1.2-gnomekeyring-1.0',
              'libgnome-keyring0',
              'lsb-release'
            ], suggests)),
            Enhances: _.sortBy(_.uniq(enhances)),
            'Pre-Depends': _.sortBy(_.uniq(preDepends))
          } // object with both user and default dependencies based on src/installer.js

          // Creates object based on stdout (values are still strings)
          let destDependencies = _.fromPairs(_.chunk(_.initial(stdout.split(/\n|:\s/)), 2))
          // String values are mapped into sorted arrays
          destDependencies = _.mapValues(destDependencies, function (value) {
            if (value) return _.sortBy(value.split(', '))
          })

          if (_.isEqual(baseDependencies, destDependencies)) {
            done()
          } else {
            done(new Error('There are duplicate dependencies'))
          }
        })
      })
    })
  })
})
