# `electron-installer-debian` - Changes by Version

## [Unreleased]

[Unreleased]: https://github.com/electron-userland/electron-installer-debian/compare/v3.1.0...master

## [3.1.0] - 2020-06-28

[3.1.0]: https://github.com/electron-userland/electron-installer-debian/compare/v3.0.0...v3.1.0

### Added

* Electron 9 dependency compatibility (#224)

## [3.0.0] - 2020-01-22

[3.0.0]: https://github.com/electron-userland/electron-installer-debian/compare/v2.0.1...v3.0.0

### Added

* Electron 8 dependency compatibility (electron-userland/electron-installer-common#45)

### Removed

* Node &lt; 10 support (#220)

## [2.0.1] - 2019-09-12

[2.0.1]: https://github.com/electron-userland/electron-installer-debian/compare/v2.0.0...v2.0.1

### Fixed

* Ensure scripts have the executable bit set (#211)

## [2.0.0] - 2019-06-11

[2.0.0]: https://github.com/electron-userland/electron-installer-debian/compare/v1.2.0...v2.0.0

### Added

* ATSPI dependency for Electron >= 5 (#200)

### Fixed

* Add revision, when present, to the default output filename (#199)

### Removed

* Node &lt; 8 support (#194)

## [1.2.0] - 2019-05-01

[1.2.0]: https://github.com/electron-userland/electron-installer-debian/compare/v1.1.1...v1.2.0

### Added

* Support for SUID sandbox helper in Electron >= 5 (#184)

### Fixed

* Allow GConf dependency with non-deprecated package name (#185)

## [1.1.1] - 2019-02-20

[1.1.1]: https://github.com/electron-userland/electron-installer-debian/compare/v1.1.0...v1.1.1

### Changed

* Upgrade to `electron-installer-common@^0.6.1` (#174)

## [1.1.0] - 2019-01-06

[1.1.0]: https://github.com/electron-userland/electron-installer-debian/compare/v1.0.1...v1.1.0

### Added

* Package names are normalized to conform to Debian policy (#170)

### Fixed

* Make sure that binary symlinks actually point to a valid file
  (electron-userland/electron-installer-common#6)

## [1.0.1] - 2018-12-12

[1.0.1]: https://github.com/electron-userland/electron-installer-debian/compare/v1.0.0...v1.0.1

### Fixed

* Provide a suggestion for how to resolve the description error (#149)
* Don't trim the leading v from the Electron version (#153)
* Ensure that certain CLI options are always parsed as arrays (#155)
* Update Electron dependencies for 3.x/4.x (#159)

## [1.0.0] - 2018-10-05

[1.0.0]: https://github.com/electron-userland/electron-installer-debian/compare/v0.8.1...v1.0.0

### Added

* Support for Electron >= 2.0 (#132)
* `transformVersion` as an exportable function (#144)

### Fixed

* Warn when directory umask may not work with dpkg (#134)

### Removed

* Node-style callback support (use [`nodeify`](https://npm.im/nodeify) if you need that
  functionality)
* Node < 6 support (#145)

## [0.8.1] - 2018-02-20

[0.8.1]: https://github.com/electron-userland/electron-installer-debian/compare/v0.8.0...v0.8.1

### Fixed

* Handling executables trying to spawn that don't exist (#130)

## [0.8.0] - 2018-01-18

[0.8.0]: https://github.com/electron-userland/electron-installer-debian/compare/v0.7.2...v0.8.0

### Added

* Promise support (#124)

## [0.7.2] - 2018-01-18

[0.7.2]: https://github.com/electron-userland/electron-installer-debian/compare/v0.7.1...v0.7.2

### Fixed

* Multiple-line `productDescription`s with lines beginning with spaces (#125)

## [0.7.1] - 2017-11-13

[0.7.1]: https://github.com/electron-userland/electron-installer-debian/compare/v0.7.0...v0.7.1

### Fixed

* Deduplicate dependencies when passing options via the command line (#112)

## [0.7.0] - 2017-11-09

[0.7.0]: https://github.com/electron-userland/electron-installer-debian/compare/v0.6.0...v0.7.0

### Added

* Support for SVG icons (#104)

### Fixed

* Update Debian dependencies for Electron apps (#105)
* Throw proper error when no description or productDescription is provided (#109)
* Append user dependencies to defaults & deduplicate (#111)

## [0.6.0] - 2017-09-27

[0.6.0]: https://github.com/electron-userland/electron-installer-debian/compare/v0.5.2...v0.6.0

### Added

* Support custom desktop file templates (#98)
* Support package maintainer scripts (#91)

### Fixed

* Remove lintian warnings/errors (#96)

----

For versions prior to 0.6.0, please see `git log`.
