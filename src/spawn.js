import { spawn as crossSpawn } from '@malept/cross-spawn-promise'

function updateExecutableMissingException (err, hasLogger) {
  if (hasLogger && err.code === 'ENOENT' && err.syscall === 'spawn dpkg-deb') {
    const installer = process.platform === 'darwin' ? 'brew' : 'apt-get'

    err.message = `Your system is missing the dpkg package. Try, e.g. '${installer} install dpkg'`
  }
}

export default async function spawn (cmd, args, logger) {
  return crossSpawn(cmd, args, {
    logger,
    updateErrorCallback: updateExecutableMissingException
  })
}
