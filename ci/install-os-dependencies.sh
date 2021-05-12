#!/usr/bin/env bash

case "$(uname -s)" in
  Darwin)
    brew install dpkg fakeroot
    ;;
  Linux)
    sudo apt-get --yes --quiet install lintian
    ;;
esac
