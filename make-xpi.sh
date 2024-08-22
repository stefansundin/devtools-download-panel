#!/bin/bash -ex
mkdir -p dist
cp -r chrome/{img,*.css,*.html,*.js} firefox
V=$(cat firefox/manifest.json | jq -Mr .version)
rm -f "download-panel-$V.zip"
cd firefox
zip -r "../dist/download-panel-$V.xpi" . -x '*.git*' -x '*.DS_Store' -x '*Thumbs.db' -x '*.md'

diff ../chrome/manifest.json manifest.json
