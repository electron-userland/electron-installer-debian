import { after, before, describe, it } from 'node:test'
import { expect } from 'chai'

import spawn from '../src/spawn.js'

describe('spawn', () => {
  let oldPath

  before(() => {
    oldPath = process.env.PATH
    process.env.PATH = '/non-existent-path'
  })

  it('should throw a human-friendly error when it cannot find dpkg-deb', async () => {
    try {
      await spawn('dpkg-deb', ['--version'], () => {})
      throw new Error('dpkg-deb should not have been executed')
    } catch (error) {
      expect(error.message).to.match(/Error executing command \(dpkg-deb --version\):\nYour system is missing the dpkg package/)
    }
  })

  after(() => {
    process.env.PATH = oldPath
  })
})
