#!/bin/sh
# Copies the game sources from the working folder into this repo (dev helper).
set -e
SRC=${1:-/home/claude/tennis}
mkdir -p web/src web/build
cp "$SRC"/src/*.js "$SRC"/src/template.html web/src/
rm -f web/src/three-entry.js
cp "$SRC"/build/three.min.js web/build/
cp "$SRC"/build.py web/
python3 web/build.py --out ios/Netcord/Resources/www/index.html
