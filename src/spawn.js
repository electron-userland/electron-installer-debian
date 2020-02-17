'use strict'

const { spawn } = require('@malept/cross-spawn-promise')

function updateExecutableMissingException (err, hasLogger) {
  if (hasLogger && err.code === 'ENOENT') {
    const isFakeroot = err.syscall === 'spawn fakeroot'
    const isDpkg = !isFakeroot && err.syscall === 'spawn dpkg'

    if (isFakeroot || isDpkg) {
      const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'
      const pkg = isFakeroot ? 'fakeroot' : 'dpkg'

      err.message = `Your system is missing the ${pkg} package. Try, e.g. '${installer} install ${pkg}'`
    }
  }
}

module.exports = async function (cmd, args, logger) {
  return spawn(cmd, args, {
    logger,
    updateErrorCallback: updateExecutableMissingException
  })
}
