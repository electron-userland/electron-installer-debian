# Support for `electron-installer-debian`

If you have questions about usage, we encourage you to visit one of the several [community-driven
sites](https://github.com/electron/electron#community).

## Troubleshooting

One way to troubleshoot potential problems is to set the `DEBUG` environment variable before
calling `electron-installer-debian`. This will print debug information from the specified modules.
The value of the environment variable is a comma-separated list of modules which support this
logging feature. Known modules include:

* `electron-installer-debian` (always use this one before filing an issue)

We use the [`debug`](https://www.npmjs.com/package/debug#usage) module for this functionality. It
has examples on how to set environment variables if you don't know how.

**If you are using `npm run` to execute `electron-installer-debian`, run the
`electron-installer-debian` command without using `npm run` and make a note of the output, because
`npm run` does not print out error messages when a script errors.**
