'use strict'

const fs = require('fs')
const retry = require('retry')

module.exports = function (path, callback) {
  const operation = retry.operation({
    retries: 3,
    minTimeout: 500
  })

  operation.attempt(function () {
    fs.access(path, function (err) {
      if (operation.retry(err)) {
        return
      }

      callback(err ? operation.mainError() : null)
    })
  })
}
