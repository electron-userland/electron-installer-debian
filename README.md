![Electron Installer for Debian](resources/logo.png)

# electron-installer-debian [![Version](https://img.shields.io/npm/v/electron-installer-debian.svg)](https://www.npmjs.com/package/electron-installer-debian) [![Build Status](https://img.shields.io/travis/electron-userland/electron-installer-debian.svg)](http://travis-ci.org/electron-userland/electron-installer-debian)

> Create a Debian package for your Electron app.

----

[Usage](#usage) |
[Options](#options) |
[Release Notes](https://github.com/electron-userland/electron-installer-debian/blob/main/NEWS.md) |
[License](https://github.com/electron-userland/electron-installer-debian/blob/main/LICENSE) |
[Code of Conduct](https://github.com/electron-userland/electron-installer-debian/blob/main/CODE_OF_CONDUCT.md) |
[Support](https://github.com/electron-userland/electron-installer-debian/blob/main/SUPPORT.md)

## Requirements

This tool requires Node 10 or greater, `fakeroot`, and `dpkg` to build the `.deb` package.

I'd recommend building your packages on your target platform, but if you insist on using Mac OS X, you can install these tools through [Homebrew](http://brew.sh/):

```
$ brew install fakeroot dpkg
```


## Installation

For use from command-line:

```
$ npm install -g electron-installer-debian
```

For use in npm scripts or programmatically:

```
$ npm install --save-dev electron-installer-debian
```


## Usage

Say your Electron app lives in `path/to/app`, and has a structure like this:

```
.
├── LICENSE
├── README.md
├── node_modules
│   ├── electron-packager
│   └── electron
├── package.json
├── resources
│   ├── Icon.png
│   ├── IconTemplate.png
│   └── IconTemplate@2x.png
└── src
    ├── index.js
    ├── main
    │   └── index.js
    └── renderer
        ├── index.html
        └── index.js
```

You now run `electron-packager` to build the app for Debian:

```
$ electron-packager . app --platform linux --arch x64 --out dist/
```

And you end up with something like this in your `dist` folder:

```
.
└── dist
    └── app-linux-x64
        ├── LICENSE
        ├── LICENSES.chromium.html
        ├── content_shell.pak
        ├── app
        ├── icudtl.dat
        ├── libgcrypt.so.11
        ├── libnode.so
        ├── locales
        ├── natives_blob.bin
        ├── resources
        ├── snapshot_blob.bin
        └── version
```

How do you turn that into a Debian package that your users can install?

### Command-Line

If you want to run `electron-installer-debian` straight from the command-line, install the package globally:

```
$ npm install -g electron-installer-debian
```

And point it to your built app:

```
$ electron-installer-debian --src dist/app-linux-x64/ --dest dist/installers/ --arch amd64
```

You'll end up with the package at `dist/installers/app_0.0.1_amd64.deb`.

### Scripts

If you want to run `electron-installer-debian` through npm, install the package locally:

```
$ npm install --save-dev electron-installer-debian
```

Edit the `scripts` section of your `package.json`:

```json
{
  "name": "app",
  "description": "An awesome app!",
  "version": "0.0.1",
  "scripts": {
    "start": "electron .",
    "build": "electron-packager . app --platform linux --arch x64 --out dist/",
    "deb64": "electron-installer-debian --src dist/app-linux-x64/ --dest dist/installers/ --arch amd64"
  },
  "devDependencies": {
    "electron-installer-debian": "^0.6.0",
    "electron-packager": "^9.0.0",
    "electron": "~1.7.0"
  }
}
```

_*Note*: The versions in `devDependencies` are examples only, please use the latest package versions
when possible._

And run the script:

```
$ npm run deb64
```

You'll end up with the package at `dist/installers/app_0.0.1_amd64.deb`.

### Programmatically

Install the package locally:

```
$ npm install --save-dev electron-installer-debian
```

And write something like this:

```javascript
const installer = require('electron-installer-debian')

const options = {
  src: 'dist/app-linux-x64/',
  dest: 'dist/installers/',
  arch: 'amd64'
}

async function main (options) {
  console.log('Creating package (this may take a while)')
  try {
    await installer(options)
    console.log(`Successfully created package at ${options.dest}`)
  } catch (err) {
    console.error(err, err.stack)
    process.exit(1)
  }
}
main(options)
```

You'll end up with the package at `dist/installers/app_0.0.1_amd64.deb`.

_Note: As of 1.0.0, the Node-style callback pattern is no longer available. You can use
[`util.callbackify`](https://nodejs.org/api/util.html#util_util_callbackify_original) if this is
required for your use case._

### Options

Even though you can pass most of these options through the command-line interface, it may be easier to create a configuration file:

```javascript
{
  "dest": "dist/installers/",
  "icon": "resources/Icon.png",
  "compression": "gzip",
  "categories": [
    "Utility"
  ],
  "lintianOverrides": [
    "changelog-file-missing-in-native-package"
  ]
}
```

And pass that instead with the `config` option:

```
$ electron-installer-debian --src dist/app-linux-x64/ --arch amd64 --config config.json
```

Anyways, here's the full list of options:

#### src
Type: `String`
Default: `undefined`

Path to the folder that contains your built Electron application.

#### dest
Type: `String`
Default: `undefined`

Path to the folder that will contain your Debian installer.

#### rename
Type: `Function`
Default: `function (dest, src) { return path.join(dest, src); }`

Function that renames all files generated by the task just before putting them in your `dest` folder.

#### options.name
Type: `String`
Default: `package.name || "electron"`

Name of the package (e.g. `atom`), used in the [`Package` field of the `control` specification](https://www.debian.org/doc/debian-policy/#package).

According to the *Debian Policy Manual*:

> Package names [...] must consist only of lower case letters (a-z), digits (0-9), plus (+) and minus (-) signs, and periods (.). They must be at least two characters long and must start with an alphanumeric character.

`electron-installer-debian` will try to help conform to these requirements by lowercasing the name
provided and replacing any invalid characters with `-`s.

#### options.productName
Type: `String`
Default: `package.productName || package.name`

Name of the application (e.g. `Atom`), used in the [`Name` field of the `desktop` specification](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html).

#### options.genericName
Type: `String`
Default: `package.genericName || package.productName || package.name`

Generic name of the application (e.g. `Text Editor`), used in the [`GenericName` field of the `desktop` specification](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html).

#### options.description
Type: `String`
Default: `package.description`

Short description of the application, used in the [`Description` field of the `control` specification](https://www.debian.org/doc/debian-policy/#the-single-line-synopsis).

#### options.productDescription
Type: `String`
Default: `package.productDescription || package.description`

Long description of the application, used in the [`Description` field of the `control` specification](https://www.debian.org/doc/debian-policy/#the-extended-description).

#### options.version
Type: `String`
Default: `package.version || "0.0.0"`

Version number of the package, used in the [`Version` field of the `control` specification](https://www.debian.org/doc/debian-policy/#version).

#### options.revision
Type: `String`
Default: `undefined`

Revision number of the package, used in the [`Version` field of the `control` specification](https://www.debian.org/doc/debian-policy/#version) and, by default, the filename of the generated `.deb` file.

#### options.section
Type: `String`
Default: `"utils"`

Application area into which the package has been classified, used in the [`Section` field of the `control` specification](https://www.debian.org/doc/debian-policy/#section).

You can read more about [sections](https://www.debian.org/doc/debian-policy/#sections), and also check out the [list of existing sections in Debian unstable](https://packages.debian.org/unstable/).

#### options.priority
Type: `String`
Default: `"optional"`

How important it is that the user have the package installed., used in the [`Priority` field of the `control` specification](https://www.debian.org/doc/debian-policy/#priority).

You can read more about [priorities](https://www.debian.org/doc/debian-policy/#priorities).

#### options.arch
Type: `String`
Default: `undefined`

Machine architecture the package is targeted to, used in the [`Architecture` field of the `control` specification](https://www.debian.org/doc/debian-policy/#architecture).

For possible values see the output of `dpkg-architecture -L`.

#### options.size
Type: `Integer`
Default: `size of the folder`

Estimate of the total amount of disk space required to install the named package, used in the [`Installed-Size` field of the `control` specification](https://www.debian.org/doc/debian-policy/#installed-size).

#### options.depends, recommends, suggests, enhances, preDepends
Type: `Array[String]`
Default: For `depends`, the minimum set of packages necessary for Electron to run; See [source code](https://github.com/electron-userland/electron-installer-debian/blob/53fb5c5/src/installer.js#L146-L157) for `recommends`, `suggests`, `enhances`, and `preDepends` default values

Relationships to other packages, used in the [`Depends`, `Recommends`, `Suggests`, `Enhances` and `Pre-Depends` fields of the `control` specification](https://www.debian.org/doc/debian-policy/#binary-dependencies-depends-recommends-suggests-enhances-pre-depends).

All user dependencies will be appended to the `Default` array of dependencies and any duplicates will be removed.

#### options.maintainer
Type: `String`
Default: `package.author.name <package.author.email>`

Maintainer of the package, used in the [`Maintainer` field of the `control` specification](https://www.debian.org/doc/debian-policy/#maintainer).

#### options.homepage
Type: `String`
Default: `package.homepage || package.author.url`

URL of the homepage for the package, used in the [`Homepage` field of the `control` specification](https://www.debian.org/doc/debian-policy/#homepage).

#### options.bin
Type: `String`
Default: `package.name || "electron"`

Relative path to the executable that will act as binary for the application, used in the [`Exec` field of the `desktop` specification](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html).

The generated package will contain a symlink `/usr/bin/<%= options.name %>` pointing to the path provided here.

For example, providing this configuration:

```javascript
{
  src: '...',
  dest: '...',
  name: 'foo',
  bin: 'resources/cli/launcher.sh'
}
```

Will create a package with the following symlink:

```
usr/bin/foo@ -> ../lib/foo/resources/cli/launcher.sh
```

And a desktop specification with the following `Exec` key:

```
Exec=foo %U
```

#### options.icon
Type: `String` or `Object[String:String]`
Default: [`resources/icon.png`](https://github.com/electron-userland/electron-installer-debian/blob/main/resources/icon.png)

Path to a single image that will act as icon for the application:

```javascript
{
  icon: 'resources/Icon.png'
}
```

Or multiple images with their corresponding resolutions:

```javascript
{
  icon: {
    '48x48': 'resources/Icon48.png',
    '64x64': 'resources/Icon64.png',
    '128x128': 'resources/Icon128.png',
    '256x256': 'resources/Icon256.png',
    'scalable': 'resources/Icon.svg'
  }
}
```
Note that the image files must be one of the types: PNG or SVG. The support for SVG works only on `scalable` resolution.

#### options.categories
Type: `Array[String]`
Default: `['GNOME', 'GTK', 'Utility']`

Categories in which the application should be shown in a menu, used in the [`Categories` field of the `desktop` specification](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html).

For possible values check out the [Desktop Menu Specification](http://standards.freedesktop.org/menu-spec/latest/apa.html).

#### options.mimeType
Type: `Array[String]`
Default: `[]`

MIME types the application is able to open, used in the [`MimeType` field of the `desktop` specification](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html).

#### options.lintianOverrides
Type: `Array[String]`
Default: `[]`

You can use these to quieten [`lintian`](https://lintian.debian.org/manual/).

#### options.scripts
Type: `Object[String:String]`
Default: `undefined`

Path to package maintainer scripts with their corresponding name, used in the [installation procedure](https://www.debian.org/doc/debian-policy/#introduction-to-package-maintainer-scripts):

```javascript
{
  scripts: {
    'preinst': 'resources/preinst_script',
    'postinst': 'resources/postinst_script',
    'prerm': 'resources/prerm_script',
    'postrm': 'resources/postrm_script'
  }
}
```
You can read more about [package maintainer scripts](https://www.debian.org/doc/debian-policy/#package-maintainer-scripts-and-installation-procedure) and [general scripts](https://www.debian.org/doc/debian-policy/#scripts)

#### options.desktopTemplate
Type: `String`
Default: [`resources/desktop.ejs`](https://github.com/electron-userland/electron-installer-debian/blob/main/resources/desktop.ejs)

The absolute path to a custom template for the generated [FreeDesktop.org desktop
entry](http://standards.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html) file.

#### options.compression
Type: `String`
Default: `xz`

Set the compression type used by dpkg-deb when building .deb package
Allowed values: `'xz', 'gzip', 'bzip2', 'lzma', 'zstd', 'none'`

Used by `dpkg-deb` to set the compression type. You can read more about it on the [manual page of `dpkg-deb`](https://man7.org/linux/man-pages/man1/dpkg-deb.1.html)

### Installed Package

The package installs the Electron application into `/usr/lib`, since there are
architecture-specific files in the package. There was a [discussion in the issue
tracker](https://github.com/electron-userland/electron-installer-debian/issues/46) about the
installation directory.

In versions of `electron-installer-debian` prior to 0.5.0, the app was (incorrectly) installed in
`/usr/share`.

## Meta

* Code: `git clone git://github.com/electron-userland/electron-installer-debian.git`
* Home: <https://github.com/electron-userland/electron-installer-debian/>


## Contributors

* Daniel Perez Alvarez ([unindented@gmail.com](mailto:unindented@gmail.com))


## License

Copyright (c) 2016 Daniel Perez Alvarez ([unindented.org](https://unindented.org/)). This is free software, and may be redistributed under the terms specified in the LICENSE file.
