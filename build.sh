#!/bin/bash

# Build script for Obision Extension Grid

echo "Building Obision Extension Grid..."

# Compile GSettings schemas
echo "Compiling schemas..."
glib-compile-schemas schemas/

# Pack the extension
echo "Packing extension..."
gnome-extensions pack --force \
    --extra-source=schemas/ \
    --extra-source=src/

echo "Build complete! Extension package created."
echo "To install, run: gnome-extensions install --force obision-extension-grid@obision.com.shell-extension.zip"
