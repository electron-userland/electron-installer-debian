'use strict'

var rimraf = require('rimraf')
var access = require('./helpers/access')
var spawn = require('./helpers/spawn')

describe('cli', function () {
  this.timeout(10000)

  describe('with an app with asar', function (test) {
    var dest = 'test/fixtures/out/foo/'

    before(function (done) {
      spawn('./src/cli.js', [
        '--src', 'test/fixtures/app-with-asar/',
        '--dest', dest,
        '--arch', 'i386'
      ], done)
    })

    after(function (done) {
      rimraf(dest, done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'footest_0.0.1_i386.deb', done)
    })
  })

  describe('with an app without asar', function (test) {
    var dest = 'test/fixtures/out/bar/'

    before(function (done) {
      spawn('node src/cli.js', [
        '--src', 'test/fixtures/app-without-asar/',
        '--dest', dest,
        '--arch', 'amd64'
      ], done)
    })

    it('generates a `.deb` package', function (done) {
      access(dest + 'bartest_0.0.1_amd64.deb', done)
    })
  })
})
