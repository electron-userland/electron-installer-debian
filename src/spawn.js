import { spawn as crossSpawn } from '@malept/cross-spawn-promise'

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

export default async function spawn (cmd, args, logger) {
  return crossSpawn(cmd, args, {
    logger,
    updateErrorCallback: updateExecutableMissingException
  })
}
