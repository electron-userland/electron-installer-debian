import common from 'electron-installer-common'

const dependencyMap = {
  atspi: 'libatspi2.0-0',
  drm: 'libdrm2',
  gbm: 'libgbm1',
  gconf: 'libgconf-2-4 | libgconf2-4',
  glib2: 'libglib2.0-bin',
  gtk2: 'libgtk2.0-0',
  gtk3: 'libgtk-3-0',
  gvfs: 'gvfs',
  kdeCliTools: 'kde-cli-tools',
  kdeRuntime: 'kde-runtime',
  notify: 'libnotify4',
  nss: 'libnss3',
  trashCli: 'trash-cli',
  uuid: 'libuuid1',
  xcbDri3: 'libxcb-dri3-0',
  xdgUtils: 'xdg-utils',
  xss: 'libxss1',
  xtst: 'libxtst6'
}

/**
 * Transforms the list of trash requires into an OR'd string.
 */
function trashRequiresAsBoolean (electronVersion, dependencyMap) {
  return [common.getTrashDepends(electronVersion, dependencyMap).join(' | ')]
}

export default {
  /**
   * The dependencies for Electron itself, given an Electron version.
   */
  forElectron: function dependenciesForElectron (electronVersion) {
    return {
      depends: common.getDepends(electronVersion, dependencyMap)
        .concat(['libsecret-1-0'])
        .concat(trashRequiresAsBoolean(electronVersion, dependencyMap)),
      recommends: [
        'libasound2t64 | libasound2 | pulseaudio'
      ],
      suggests: [
        'gnome-keyring',
        'lsb-release'
      ],
      enhances: [
      ],
      preDepends: [
      ]
    }
  }
}
