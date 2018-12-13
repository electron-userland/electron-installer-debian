'use strict'

const { spawn } = require('electron-installer-common')

function updateExecutableMissingException (err, updateError) {
  if (updateError && err.code === 'ENOENT') {
    const isFakeroot = err.syscall === 'spawn fakeroot'
    const isDpkg = !isFakeroot && err.syscall === 'spawn dpkg'

    if (isFakeroot || isDpkg) {
      const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'
      const pkg = isFakeroot ? 'fakeroot' : 'dpkg'

      err.message = `Your system is missing the ${pkg} package. Try, e.g. '${installer} install ${pkg}'`
    }
  }
}

module.exports = function (cmd, args, logger) {
  return spawn(cmd, args, logger, updateExecutableMissingException)
}
