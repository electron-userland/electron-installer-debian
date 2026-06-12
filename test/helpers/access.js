'use strict'

const fs = require('node:fs/promises')
const retry = require('promise-retry')

/**
 * `fs.access` which retries three times.
 */
module.exports = async function (path) {
  return retry((retry, number) => {
    return fs.access(path)
      .catch(retry)
  }, {
    retries: 3,
    minTimeout: 500
  })
}
