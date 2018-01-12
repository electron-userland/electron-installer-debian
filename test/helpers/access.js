'use strict'

const fs = require('fs-extra')
const retry = require('promise-retry')

/**
 * `fs.access` which retries three times.
 */
module.exports = function (path) {
  return retry((retry, number) => {
    return fs.access(path)
      .catch(retry)
  }, {
    retries: 3,
    minTimeout: 500
  })
}
