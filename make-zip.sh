#!/bin/bash -ex
V=$(cat download-panel/manifest.json | grep '"version"' | grep -o "\d*\.\d*\.\d*")
rm -f "download-panel-$V.zip"
zip -r "download-panel-$V.zip" download-panel/*
