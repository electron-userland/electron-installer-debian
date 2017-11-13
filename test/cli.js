'use strict'

var fs = require('fs-extra')
var access = require('./helpers/access')
var spawn = require('./helpers/spawn')
var child = require('child_process')
var _ = require('lodash')

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
      fs.remove(dest, done)
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

  describe('with duplicate dependencies', function (test) {
    var dest = 'test/fixtures/out/tjaq/'
    var config = 'test/fixtures/config.json'

    // Default options (from src/installer.js)
    var defaults = {
      depends: ['gvfs-bin',
        'libgconf2-4',
        'libgtk2.0-0',
        'libnotify4',
        'libnss3',
        'libxtst6',
        'xdg-utils'],
      recommends: ['pulseaudio | libasound2'],
      suggests: ['gir1.2-gnomekeyring-1.0',
        'libgnome-keyring0',
        'lsb-release'],
      enhances: [],
      preDepends: []
    }

    before(function (done) {
      spawn('./src/cli.js', [
        '--src', 'test/fixtures/app-with-asar/',
        '--dest', dest,
        '--arch', 'i386',
        '--config', config
      ], done)
    })

    after(function (done) {
      fs.remove(dest, done)
    })

    it('removes duplicate dependencies', function (done) {
      access(dest + 'footest_0.0.1_i386.deb', function () {
        var dpkgDebCmd = 'dpkg-deb -f footest_0.0.1_i386.deb ' +
          'Depends Recommends Suggests Enhances Pre-Depends'
        child.exec(dpkgDebCmd, { cwd: dest }, function (err, stdout, stderr) {
          if (err) return done(err)
          if (stderr) return done(new Error(stderr.toString()))

          // object with both user and default dependencies based on src/installer.js
          fs.readJson(config, function (err, configObj) {
            if (err) return done(err)

            var baseDependencies = {}
            baseDependencies['Depends'] = _.sortBy(_.union(defaults.depends, configObj.depends))
            baseDependencies['Recommends'] = _.sortBy(_.union(defaults.recommends, configObj.recommends))
            baseDependencies['Suggests'] = _.sortBy(_.union(defaults.suggests, configObj.suggests))
            baseDependencies['Enhances'] = _.sortBy(_.union(defaults.enhances, configObj.enhances))
            baseDependencies['Pre-Depends'] = _.sortBy(_.union(defaults.preDepends, configObj.preDepends))

            // Creates object based on stdout (values are still strings)
            var destDependencies = _.fromPairs(_.chunk(_.initial(stdout.split(/\n|:\s/)), 2))
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
})
