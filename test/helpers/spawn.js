'use strict'

const child = require('child_process')

module.exports = function (cmd, args, callback) {
  const cmds = cmd.split(' ')
  let spawnedProcess = null
  let error = null
  let stderr = ''

  try {
    spawnedProcess = child.spawn(cmds[0], cmds.slice(1).concat(args))
  } catch (err) {
    process.nextTick(function () {
      callback(err, stderr)
    })
    return
  }

  spawnedProcess.stderr.on('data', function (data) {
    stderr += data
  })

  spawnedProcess.on('error', function (err) {
    error = error || err
  })

  spawnedProcess.on('close', function (code, signal) {
    if (code !== 0) {
      error = error || signal || code
    }

    callback(error && new Error('Error executing command (' + (error.message || error) + '): ' +
      '\n' + cmd + ' ' + args.join(' ') + '\n' + stderr))
  })
}
