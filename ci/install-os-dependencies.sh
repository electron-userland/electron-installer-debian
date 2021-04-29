#!/usr/bin/env bash

case "$(uname -s)" in
  Darwin)
    brew install dpkg fakeroot
    ;;
esac
