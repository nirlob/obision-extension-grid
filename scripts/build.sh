#!/bin/bash

# Build script for Obision One Win

echo "Building Obision One Win..."

# Compile GSettings schemas
echo "Compiling schemas..."
glib-compile-schemas schemas/

# Pack the extension
echo "Packing extension..."
gnome-extensions pack --force \
    --extra-source=schemas/ \
    --extra-source=src/

echo "Build complete! Extension package created."
echo "To install, run: gnome-extensions install --force obision-extension-one-win@obision.com.shell-extension.zip"
