#!/usr/bin/env bash
# Copyright (c) 2018-Present Lea Anthony
# SPDX-License-Identifier: MIT

# Fail script on any error
set -euxo pipefail

# Define variables
APP_DIR="${APP_NAME}.AppDir"

# Create AppDir structure
mkdir -p "${APP_DIR}/usr/bin"
cp -r "${APP_BINARY}" "${APP_DIR}/usr/bin/"
cp "${ICON_PATH}" "${APP_DIR}/"
cp "${DESKTOP_FILE}" "${APP_DIR}/"

if [[ $(uname -m) == *x86_64* ]]; then
    # Download linuxdeploy and make it executable
    wget -q -4 -N https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
    chmod +x linuxdeploy-x86_64.AppImage

    # Run linuxdeploy to bundle the application
    ./linuxdeploy-x86_64.AppImage --appdir "${APP_DIR}" --output appimage
else
    # Download linuxdeploy and make it executable (arm64)
    wget -q -4 -N https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-aarch64.AppImage
    chmod +x linuxdeploy-aarch64.AppImage

    # Run linuxdeploy to bundle the application (arm64)
    ./linuxdeploy-aarch64.AppImage --appdir "${APP_DIR}" --output appimage
fi

# llama.cpp is built with OpenMP, so the binary depends on libgomp.so.1 at
# runtime. linuxdeploy may skip GCC runtime libs; bundle it explicitly so the
# AppImage runs on systems without gcc.
if [ -z "$(find "${APP_DIR}" -name 'libgomp.so.1*' -print -quit)" ]; then
    LIBGOMP="$(ldconfig -p 2>/dev/null | awk '/libgomp\.so\.1/{print $NF; exit}' || true)"
    if [ -z "${LIBGOMP}" ]; then
        LIBGOMP="$(gcc -print-file-name=libgomp.so.1 2>/dev/null || true)"
    fi
    if [ -n "${LIBGOMP}" ] && [ -f "${LIBGOMP}" ]; then
        mkdir -p "${APP_DIR}/usr/lib"
        cp -L "${LIBGOMP}" "${APP_DIR}/usr/lib/libgomp.so.1"
        echo "Bundled libgomp.so.1 into ${APP_DIR}/usr/lib"
    else
        echo "WARNING: could not find libgomp.so.1 to bundle" >&2
    fi
fi

# Rename the generated AppImage
mv "${APP_NAME}*.AppImage" "${APP_NAME}.AppImage"

