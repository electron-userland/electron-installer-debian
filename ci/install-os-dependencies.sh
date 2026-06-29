#!/usr/bin/env bash

set -euo pipefail

case "$(uname -s)" in
  Darwin)
    brew install dpkg
    ;;
  Linux)
    sudo apt-get --quiet update
    sudo apt-get --yes --quiet install lintian
    ;;
esac
