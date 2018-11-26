#!/usr/bin/env node

const _ = require('lodash')
const yargs = require('yargs')

const installer = require('./installer')
const pkg = require('../package.json')

const argv = yargs
  .version(pkg.version)
  .usage(`${pkg.description}\n\nUsage: $0 --src <inputdir> --dest <outputdir> --arch <architecture>`)
  .option('src', {
    describe: 'Directory that contains your built Electron app (e.g. with `electron-packager`)',
    demand: true
  })
  .option('dest', {
    describe: 'Directory that will contain the resulting Debian installer',
    demand: true
  })
  .option('arch', {
    describe: 'Machine architecture the package is targeted to',
    demand: true
  })
  .option('config', {
    describe: 'JSON file that contains the metadata for your application',
    config: true
  })
  .options('options.depends', { array: true, hidden: true })
  .options('options.recommends', { array: true, hidden: true })
  .options('options.suggests', { array: true, hidden: true })
  .options('options.enhances', { array: true, hidden: true })
  .options('options.preDepends', { array: true, hidden: true })
  .options('options.categories', { array: true, hidden: true })
  .options('options.mimeType', { array: true, hidden: true })
  .options('options.lintianOverrides', { array: true, hidden: true })
  .example('$0 --src dist/app/ --dest dist/installer/ --arch i386', 'use metadata from `dist/app/`')
  .example('$0 --src dist/app/ --dest dist/installer/ --config config.json', 'use metadata from `config.json`')
  .wrap(null)
  .argv

console.log('Creating package (this may take a while)')

const options = _.omit(argv, ['$0', '_', 'version'])

installer(options)
  .then(() => console.log(`Successfully created package at ${argv.dest}`))
  .catch(/* istanbul ignore next */ err => {
    console.error(err, err.stack)
    process.exit(1)
  })
