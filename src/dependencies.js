'use strict'

const dependencies = require('electron-installer-common/src/dependencies')

const dependencyMap = {
  gconf: 'libgconf2-4',
  glib2: 'libglib2.0-bin',
  gtk2: 'libgtk2.0-0',
  gtk3: 'libgtk-3-0',
  gvfs: 'gvfs-bin',
  kdeCliTools: 'kde-cli-tools',
  kdeRuntime: 'kde-runtime',
  notify: 'libnotify4',
  nss: 'libnss3',
  trashCli: 'trash-cli',
  uuid: 'libuuid1',
  xdgUtils: 'xdg-utils',
  xss: 'libxss1',
  xtst: 'libxtst6'
}

module.exports = {
  dependencyMap: dependencyMap,
  /**
   * The dependencies for Electron itself, given an Electron version.
   */
  forElectron: function dependenciesForElectron (electronVersion) {
    return {
      depends: dependencies.getDepends(electronVersion, dependencyMap),
      recommends: [
        'pulseaudio | libasound2'
      ],
      suggests: [
        'gir1.2-gnomekeyring-1.0',
        'libgnome-keyring0',
        'lsb-release'
      ],
      enhances: [
      ],
      preDepends: [
      ]
    }
  }
}
