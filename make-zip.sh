#!/bin/bash -ex
mkdir -p dist
V=$(cat chrome/manifest.json | jq -Mr .version)
rm -f "download-panel-$V.zip"
cd chrome
zip -r "../dist/download-panel-$V.zip" . -x '*.DS_Store' -x '*Thumbs.db'
