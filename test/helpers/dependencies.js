'use strict'

const _ = require('lodash')
const exec = require('child_process').exec

const dependencies = require('../../src/dependencies')

// Default options (partly from src/installer.js)
const defaults = {
  depends: dependencies.getDepends('gvfs-bin'),
  recommends: ['pulseaudio | libasound2'],
  suggests: [
    'gir1.2-gnomekeyring-1.0',
    'libgnome-keyring0',
    'lsb-release'
  ],
  enhances: [],
  preDepends: []
}

module.exports = {
  assertDependenciesEqual: function assertDependenciesEqual (outputDir, debFilename, userDependencies, done) {
    const dpkgDebCmd = `dpkg-deb -f ${debFilename} Depends Recommends Suggests Enhances Pre-Depends`
    exec(dpkgDebCmd, { cwd: outputDir }, (err, stdout, stderr) => {
      if (err) return done(err)
      if (stderr) return done(new Error(stderr.toString()))

      const baseDependencies = {
        Depends: _.sortBy(_.union(defaults.depends, userDependencies.depends)),
        Recommends: _.sortBy(_.union(defaults.recommends, userDependencies.recommends)),
        Suggests: _.sortBy(_.union(defaults.suggests, userDependencies.suggests)),
        Enhances: _.sortBy(_.union(defaults.enhances, userDependencies.enhances)),
        'Pre-Depends': _.sortBy(_.union(defaults.preDepends, userDependencies.preDepends))
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
  }
}
