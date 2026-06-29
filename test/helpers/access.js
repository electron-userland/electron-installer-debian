import fs from 'node:fs/promises'
import retry from 'promise-retry'

/**
 * `fs.access` which retries three times.
 */
export default async function access (path) {
  return retry(retry => {
    return fs.access(path)
      .catch(retry)
  }, {
    retries: 3,
    minTimeout: 500
  })
}
