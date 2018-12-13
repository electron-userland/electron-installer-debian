'use strict'

const chai = require('chai')
const spawn = require('../src/spawn')

describe('spawn', () => {
  let oldPath

  before(() => {
    oldPath = process.env.PATH
    process.env.PATH = '/non-existent-path'
  })

  it('should throw a human-friendly error when it cannot find dpkg or fakeroot', () => {
    return spawn('dpkg', ['--version'], msg => {})
      .then(() => { throw new Error('dpkg should not have been executed') })
      .catch(error => chai.expect(error.message).to.match(/Error executing command \(Your system is missing the dpkg package/))
  })

  after(() => {
    process.env.PATH = oldPath
  })
})
