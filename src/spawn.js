'use strict'

const child = require('child_process')

/**
 * Spawn a child process.
 */
module.exports = function (cmd, args, logger, callback) {
  let spawnedProcess = null
  let error = null
  let stderr = ''

  if (logger) logger(`Executing command ${cmd} ${args.join(' ')}`)

  try {
    spawnedProcess = child.spawn(cmd, args)
  } catch (err) {
    process.nextTick(() => {
      callback(err, stderr)
    })
    return
  }

  spawnedProcess.stderr.on('data', data => {
    stderr += data
  })

  spawnedProcess.on('error', err => {
    if (logger && err.name === 'ENOENT') {
      const isFakeroot = err.syscall === 'spawn fakeroot'
      const isDpkg = !isFakeroot && err.syscall === 'spawn dpkg'

      if (isFakeroot || isDpkg) {
        const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'
        const pkg = isFakeroot ? 'fakeroot' : 'dpkg'

        err.message = `Your system is missing the fakeroot package. Try, e.g. '${installer} install ${pkg}'`
      }
    }

    error = error || err
  })

  spawnedProcess.on('close', (code, signal) => {
    if (code !== 0) {
      error = error || signal || code
    }

    callback(error && new Error(`Error executing command (${error.message || error}):\n${cmd} ${args.join(' ')}\n${stderr}`))
  })
}
