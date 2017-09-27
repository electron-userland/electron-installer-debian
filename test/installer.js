'use strict'

var installer = require('..')

var child = require('child_process')
var fs = require('fs-extra')
var path = require('path')
var rimraf = require('rimraf')
var access = require('./helpers/access')

describe('module', function () {
  this.timeout(10000)

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
          depends: [],
          recommends: [],
          suggests: [],
          categories: []
        }
      }, done)
    })

    after(function (done) {
      rimraf(dest, done)
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
            '1024x1024': 'test/fixtures/icon.png'
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
            'executable-not-elf-or-script',
            'extra-license-file'
          ],
          scripts: {
            preinst: 'test/fixtures/debian-scripts/preinst.sh',
            postinst: 'test/fixtures/debian-scripts/postinst.sh',
            prerm: 'test/fixtures/debian-scripts/prerm.sh',
            postrm: 'test/fixtures/debian-scripts/postrm.sh'
          }
        }
      }, done)
    })

    after(function (done) {
      rimraf(dest, done)
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
      rimraf(dest, done)
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
      rimraf(dest, done)
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
      rimraf(dest, done)
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
})
