import chai from 'chai'

import spawn from '../src/spawn.js'

describe('spawn', () => {
  let oldPath

  before(() => {
    oldPath = process.env.PATH
    process.env.PATH = '/non-existent-path'
  })

  it('should throw a human-friendly error when it cannot find dpkg or fakeroot', async () => {
    try {
      await spawn('dpkg', ['--version'], () => {})
      throw new Error('dpkg should not have been executed')
    } catch (error) {
      chai.expect(error.message).to.match(/Error executing command \(dpkg --version\):\nYour system is missing the dpkg package/)
    }
  })

  after(() => {
    process.env.PATH = oldPath
  })
})
