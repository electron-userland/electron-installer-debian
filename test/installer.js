'use strict'

var installer = require('..')

var child = require('child_process')
var fs = require('fs-extra')
var path = require('path')
var access = require('./helpers/access')
var chai = require('chai')
var _ = require('lodash')

describe('module', function () {
  this.timeout(30000)

  describe('with an app with asar', function (test) {
    var dest = 'test/fixtures/out/foo/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-with-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          productDescription: 'Just a test.',
          section: 'devel',
          priority: 'optional',
          arch: 'i386',
          recommends: [],
          suggests: [],
          categories: []
        }
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'footest_i386.deb', done)
    })
  })

  describe('with an app without asar', function (test) {
    var dest = 'test/fixtures/out/bar/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-without-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          icon: {
            '1024x1024': 'test/fixtures/icon.png',
            'scalable': 'test/fixtures/icon.svg'
          },
          bin: 'resources/cli/bar.sh',
          productDescription: 'Just a test.',
          section: 'devel',
          priority: 'optional',
          arch: 'amd64',
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
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'bartest_amd64.deb', done)
    })
  })

  describe('with an app with a multi-line description', function (test) {
    var dest = 'test/fixtures/out/baz/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-without-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          description: 'Line one\nLine 2\rLine3\r\nLine 4',
          arch: 'amd64'
        }
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'bartest_amd64.deb', done)
    })
  })

  describe('with an app with a productDescription containing a blank line', function (test) {
    var dest = 'test/fixtures/out/quux/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-without-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          productDescription: 'Line one\n\nLine 2 after a blank line',
          arch: 'amd64'
        }
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'bartest_amd64.deb', done)
    })
  })

  describe('with a custom desktop template', function (test) {
    var dest = 'test/fixtures/out/custom-desktop/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-without-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          arch: 'amd64',
          desktopTemplate: 'test/fixtures/custom.desktop.ejs'
        }
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('generates a custom `.desktop` file', function (done) {
      access(dest + 'bartest_amd64.deb', function () {
        child.exec('dpkg-deb -x bartest_amd64.deb .', { cwd: dest }, function (err, stdout, stderr) {
          if (err) return done(err)
          if (stderr) return done(new Error(stderr.toString()))

          fs.readFile(dest + 'usr/share/applications/bartest.desktop', function (err, data) {
            if (err) return done(err)

            if (data.toString().indexOf('Comment=Hardcoded comment') === -1) {
              done(new Error('Did not use custom template'))
            } else {
              done()
            }
          })
        })
      })
    })
  })

  describe('with no description or productDescription provided', function (test) {
    var dest = 'test/fixtures/out/quux/'

    after(function (done) {
      fs.remove(dest, done)
    })

    it('correct message', function (done) {
      installer({
        src: 'test/fixtures/app-without-description-or-product-description/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },
        options: {
          arch: 'amd64'
        }
      }, (error) => {
        chai.expect(error.message).to.deep.equal('No Description or ProductDescription provided')
        done()
      })
    })
  })

  describe('with an app with asar and debian scripts', function (test) {
    var dest = 'test/fixtures/out/ewrf/'

    before(function (done) {
      installer({
        src: 'test/fixtures/app-with-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          productDescription: 'Just a test.',
          section: 'devel',
          priority: 'optional',
          arch: 'i386',
          depends: [],
          recommends: [],
          suggests: [],
          categories: [],
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
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('passes lintian checks', function (done) {
      access(dest + 'footest_i386.deb', function () {
        child.exec('lintian ' + dest + 'footest_i386.deb', function (err, stdout, stderr) {
          if (err) {
            console.log('error')
            done(new Error(err + stdout))
          } else if (stdout.match(/\n/g).length > 1) {
            done(new Error('Warnings not overriding:\n' + stdout))
          } else if (stdout.match(/\n/g).length === 1) {
            done()
          }
        })
      })
    })
  })

  describe('with duplicate dependencies', function (test) {
    var dest = 'test/fixtures/out/kjfq/'

    // User options with duplicates (including defaults duplicates)
    var depends = ['libnss3', 'libxtst6', 'dbus', 'dbus']
    var recommends = ['pulseaudio | libasound2', 'bzip2', 'bzip2']
    var suggests = ['lsb-release', 'gvfs', 'gvfs']
    var enhances = ['libc6', 'libc6']
    var preDepends = ['footest', 'footest']

    before(function (done) {
      installer({
        src: 'test/fixtures/app-with-asar/',
        dest: dest,
        rename: function (dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb')
        },

        options: {
          productDescription: 'Just a test.',
          section: 'devel',
          priority: 'optional',
          arch: 'i386',
          depends: depends,
          recommends: recommends,
          suggests: suggests,
          enhances: enhances,
          preDepends: preDepends,
          categories: []
        }
      }, done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('removes duplicate dependencies', function (done) {
      access(dest + 'footest_i386.deb', function () {
        child.exec('dpkg-deb -f footest_i386.deb ' +
          'Depends Recommends Suggests Enhances Pre-Depends', { cwd: dest }, function (err, stdout, stderr) {
          if (err) return done(err)
          if (stderr) return done(new Error(stderr.toString()))

          var baseDependencies = {
            Depends: _.sortBy(_.union([
              'gvfs-bin',
              'libgconf2-4',
              'libgtk2.0-0',
              'libnotify4',
              'libnss3',
              'libxtst6',
              'xdg-utils'
            ], depends)),
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
          var destDependecies = _.fromPairs(_.chunk(_.initial(stdout.split(/\n|:\s/)), 2))
          // String values are mapped into sorted arrays
          destDependecies = _.mapValues(destDependecies, function (value) {
            if (value) return _.sortBy(value.split(', '))
          })

          if (_.isEqual(baseDependencies, destDependecies)) {
            done()
          } else {
            done(new Error('There are duplicate dependencies'))
          }
        })
      })
    })
  })
})
