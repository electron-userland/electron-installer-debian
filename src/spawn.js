'use strict'

const spawn = require('cross-spawn-promise')

function updateExecutableMissingException (err, updateError) {
  if (updateError && err.name === 'ENOENT') {
    const isFakeroot = err.syscall === 'spawn fakeroot'
    const isDpkg = !isFakeroot && err.syscall === 'spawn dpkg'

    if (isFakeroot || isDpkg) {
      const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'
      const pkg = isFakeroot ? 'fakeroot' : 'dpkg'

      err.message = `Your system is missing the fakeroot package. Try, e.g. '${installer} install ${pkg}'`
    }
  }
}

/**
 * Spawn a child process and make the error message more human friendly, if possible.
 */
module.exports = function (cmd, args, logger) {
  if (logger) logger(`Executing command ${cmd} ${args.join(' ')}`)

  return spawn(cmd, args)
    .then(stdout => stdout.toString())
    .catch(err => {
      updateExecutableMissingException(err, !!logger)

      throw new Error(`Error executing command (${err.message || err}):\n${cmd} ${args.join(' ')}\n${err.stderr.toString()}`)
    })
}
