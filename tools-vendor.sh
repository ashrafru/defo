#!/bin/sh
# Rebuilds www/capacitor-bundle.js from node_modules (the app has no bundler).
set -e
N=node_modules
{
  cat $N/@capacitor/core/dist/capacitor.js; echo
  cat $N/@capacitor/synapse/dist/synapse.js; echo
  echo 'var synapse = window.outsystemsSynapse;'
  for p in @capacitor/app @capacitor/browser @capacitor/filesystem @capacitor/share @capacitor-community/file-opener; do
    sed '/sourceMappingURL/d' $N/$p/dist/plugin.js; echo
  done
} > www/capacitor-bundle.js
