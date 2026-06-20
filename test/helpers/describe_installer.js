import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import tmp from 'tmp-promise'
import { after, before, describe, it } from 'node:test'
import { expect } from 'chai'

import installer from '../../src/installer.js'

export default function describeInstaller (description, installerOptions, itDescription, itFunc) {
  describe(description, () => {
    const outputDir = tempOutputDir(installerOptions.dest)
    const options = testInstallerOptions(outputDir, installerOptions)

    before(() => installer(options))

    it(itDescription, () => itFunc(outputDir))

    cleanupOutputDir(outputDir)
  })
}

export function describeInstallerWithException (description, installerOptions, errorRegex) {
  describe(description, () => {
    const outputDir = tempOutputDir()
    cleanupOutputDir(outputDir)

    it('throws an error', () => {
      const options = testInstallerOptions(outputDir, installerOptions)
      return installer(options)
        .catch(error => expect(error.message).to.match(errorRegex))
    })
  })
}

export function cleanupOutputDir (outputDir) {
  after(() => fs.rm(outputDir, { recursive: true, force: true }))
}

export function tempOutputDir (customDir) {
  return customDir ? path.join(os.tmpdir(), customDir) : tmp.tmpNameSync({ prefix: 'electron-installer-debian-' })
}

export function testInstallerOptions (outputDir, installerOptions) {
  return {
    rename: debFile => {
      return path.join(debFile, '<%= name %>_<%= arch %>.deb')
    },
    ...installerOptions,
    options: {
      arch: 'amd64',
      ...installerOptions.options
    },
    dest: outputDir
  }
}
