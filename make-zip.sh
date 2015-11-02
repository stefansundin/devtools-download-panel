#!/bin/bash -ex
V=$(cat download-panel/manifest.json | grep '"version"' | grep -o "\d*\.\d*\.\d*")
rm -f "download-panel-v$V.zip"
zip -r "download-panel-v$V.zip" download-panel/*
