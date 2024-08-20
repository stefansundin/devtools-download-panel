#!/bin/bash -ex
mkdir -p dist
V=$(cat download-panel/manifest.json | jq -Mr .version)
rm -f "download-panel-$V.zip"
cd download-panel
zip -r "../dist/download-panel-$V.zip" . -x '*.DS_Store' -x '*Thumbs.db'
