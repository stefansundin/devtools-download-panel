#!/bin/bash -ex
WD=$(pwd)
V=$(cat download-panel/manifest.json | jq -Mr .version)

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --pack-extension="$WD/download-panel" --pack-extension-key="$WD/download-panel.pem"

mv download-panel.crx "download-panel-$V.crx"
