'use strict'

var installer = require('..')

var fs = require('fs')
var path = require('path')

describe('module', function () {
  this.timeout(10000)

  describe('with an app with asar', function (test) {
    before(function (done) {
      installer({
        src: 'test/fixtures/app-with-asar/',
        dest: 'test/fixtures/out/',
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

    it('generates a `.deb` package', function (done) {
      fs.access('test/fixtures/out/footest_i386.deb', done)
    })
  })

  describe('with an app without asar', function (test) {
    before(function (done) {
      installer({
        src: 'test/fixtures/app-without-asar/',
        dest: 'test/fixtures/out/',
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
          lintianOverrides: [
            'changelog-file-missing-in-native-package',
            'executable-not-elf-or-script',
            'extra-license-file'
          ]
        }
      }, done)
    })

    it('generates a `.deb` package', function (done) {
      fs.access('test/fixtures/out/bartest_amd64.deb', done)
    })
  })
})
