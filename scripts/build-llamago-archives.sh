#!/usr/bin/env bash
#
# build-llamago-archives.sh
#
# Builds the llama.cpp static archives for the CURRENT OS/arch and installs them
# into third_party/llama-go/<os>/<arch>/, so the vendored llama-go can link on
# Linux and macOS. This is the bash analogue of the llama-go-windows skill's
# reference/build.ps1 (which does the same thing on Windows/MinGW).
#
# The vendored third_party/llama-go ships only Windows/MinGW archives and a
# headers-only llama.cpp/ tree, so the llama.cpp SOURCE is fetched here and
# compiled into the per-OS archives. The resulting .a files are committed
# (matching the committed Windows archives), so builds thereafter need only the
# compiler on PATH - not a llama.cpp rebuild.
#
# USAGE (run on the TARGET OS):
#   LLAMA_GO_REF=<commit-or-tag> ./scripts/build-llamago-archives.sh
#
#   LLAMA_GO_REF  (required) - the llama-go commit/tag whose wrapper.h and
#     cgo_headers are vendored in third_party/llama-go. The script clones that
#     ref, then verifies its wrapper.h matches ours (ABI guard) before building;
#     it aborts if they differ so you can find the right ref.
#
#   Run it once per OS/arch you need to support:
#     - Linux amd64  -> writes third_party/llama-go/linux/amd64/
#     - macOS arm64  -> writes third_party/llama-go/darwin/arm64/
#     - macOS amd64  -> writes third_party/llama-go/darwin/amd64/
#
# REQUIREMENTS
#   Linux : gcc/g++, cmake, make (or ninja), git, ar
#   macOS : Xcode Command Line Tools (clang, clang++, cmake, make, ar), git
#
# NOTES
#   - The vendored wrapper.cpp is compiled (not the upstream one) against the
#     vendored headers, so the libbinding.a ABI matches the Go files in
#     third_party/llama-go.
#   - Linux builds with OpenMP (GGML_OPENMP=ON): the resulting binary depends on
#     libgomp.so.1 at runtime (bundle it in the AppImage, declare libgomp1 in
#     the .deb).
#   - macOS builds with the Metal + BLAS backends; the required frameworks are
#     OS-provided, so nothing extra ships.
#
set -euo pipefail

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  linux|darwin) ;;
  *) echo "ERROR: unsupported OS '$OS' (expected linux or darwin)" >&2; exit 1 ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)         GOARCH="amd64" ;;
  arm64|aarch64)  GOARCH="arm64" ;;
  *) echo "ERROR: unsupported arch '$ARCH'" >&2; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LLAMA_GO_ROOT="$REPO_ROOT/third_party/llama-go"
DEST="$LLAMA_GO_ROOT/$OS/$GOARCH"
LLAMA_GO_REF="${LLAMA_GO_REF:-}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"

if [ -z "$LLAMA_GO_REF" ]; then
  cat >&2 <<'EOF'
ERROR: LLAMA_GO_REF is required.

Set it to the llama-go commit/tag whose wrapper.h is vendored in
third_party/llama-go. The script clones that ref, verifies its wrapper.h
matches the vendored one, and aborts if it doesn't. Pick a ref until the
verification passes.

  LLAMA_GO_REF=v2.0.0 ./scripts/build-llamago-archives.sh
EOF
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Cloning llama-go at $LLAMA_GO_REF (with llama.cpp submodule)"
git clone --recurse-submodules https://github.com/tcpipuk/llama-go "$TMP/llama-go"
git -C "$TMP/llama-go" checkout --force "$LLAMA_GO_REF"
git -C "$TMP/llama-go" submodule update --init --recursive

# ABI guard: the fetched source must match the vendored headers.
if ! diff -q "$TMP/llama-go/wrapper.h" "$LLAMA_GO_ROOT/wrapper.h" >/dev/null 2>&1; then
  echo "ERROR: llama-go $LLAMA_GO_REF wrapper.h does not match the vendored" >&2
  echo "       third_party/llama-go/wrapper.h. Choose a different LLAMA_GO_REF." >&2
  exit 1
fi

CMAKE="${CMAKE:-cmake}"
CC="${CC:-gcc}"
CXX="${CXX:-g++}"
if [ "$OS" = "darwin" ]; then
  CC="${CC:-clang}"
  CXX="${CXX:-clang++}"
fi

BUILD="$TMP/build"
mkdir -p "$BUILD"

echo "==> CMake configure ($OS/$GOARCH)"
EXTRA=()
if [ "$OS" = "linux" ]; then
  EXTRA+=(-DGGML_OPENMP=ON)
  EXTRA+=(-DCMAKE_C_COMPILER="$CC" -DCMAKE_CXX_COMPILER="$CXX")
elif [ "$OS" = "darwin" ]; then
  EXTRA+=(-DGGML_METAL=ON -DGGML_BLAS=ON)
  EXTRA+=(-DCMAKE_C_COMPILER="$CC" -DCMAKE_CXX_COMPILER="$CXX")
  EXTRA+=(-DCMAKE_OSX_DEPLOYMENT_TARGET=12.0)
fi

"$CMAKE" -S "$TMP/llama-go/llama.cpp" -B "$BUILD" \
  -DBUILD_SHARED_LIBS=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release "${EXTRA[@]}"

echo "==> Building ggml llama llama-common (a few minutes)"
"$CMAKE" --build "$BUILD" --target ggml llama llama-common --config Release -j "$JOBS"
# On Apple the ggml meta-target builds ggml-metal + ggml-blas; build explicitly
# in case they are separate targets (ignore failures if already built).
if [ "$OS" = "darwin" ]; then
  "$CMAKE" --build "$BUILD" --target ggml-metal ggml-blas --config Release -j "$JOBS" || true
fi

echo "==> Compiling the vendored wrapper.cpp -> libbinding.a"
INC=(
  "-I$LLAMA_GO_ROOT/llama.cpp" "-I$LLAMA_GO_ROOT"
  "-I$LLAMA_GO_ROOT/llama.cpp/include" "-I$LLAMA_GO_ROOT/llama.cpp/ggml/include"
  "-I$LLAMA_GO_ROOT/llama.cpp/common" "-I$LLAMA_GO_ROOT/llama.cpp/vendor"
  "-I$LLAMA_GO_ROOT/cgo_headers" "-I$LLAMA_GO_ROOT/cgo_headers/llama.cpp"
  "-I$LLAMA_GO_ROOT/cgo_headers/llama.cpp/include"
  "-I$LLAMA_GO_ROOT/cgo_headers/llama.cpp/ggml/include"
  "-I$LLAMA_GO_ROOT/cgo_headers/llama.cpp/common"
  "-I$LLAMA_GO_ROOT/cgo_headers/llama.cpp/thirdparty"
)
CXX_EXTRA=()
if [ "$OS" = "darwin" ]; then
  CXX_EXTRA+=(-mmacosx-version-min=12.0)
fi

# shellcheck disable=SC2086
"$CXX" "${INC[@]}" "${CXX_EXTRA[@]}" -O3 -DNDEBUG -std=c++17 -fPIC \
  -c "$LLAMA_GO_ROOT/wrapper.cpp" -o "$TMP/wrapper.o"
ar crs "$TMP/libbinding.a" "$TMP/wrapper.o"

echo "==> Installing archives to $DEST"
mkdir -p "$DEST"
cp "$BUILD/common/libllama-common.a"      "$DEST/libllama-common.a"
cp "$BUILD/common/libllama-common-base.a" "$DEST/libllama-common-base.a"
cp "$BUILD/src/libllama.a"                "$DEST/libllama.a"
cp "$BUILD/ggml/src/ggml.a"               "$DEST/libggml.a"
cp "$BUILD/ggml/src/ggml-base.a"          "$DEST/libggml-base.a"
cp "$BUILD/ggml/src/ggml-cpu.a"           "$DEST/libggml-cpu.a"
cp "$TMP/libbinding.a"                    "$DEST/libbinding.a"
if [ "$OS" = "darwin" ]; then
  cp "$BUILD/ggml/src/ggml-metal.a" "$DEST/libggml-metal.a" || true
  cp "$BUILD/ggml/src/ggml-blas.a"  "$DEST/libggml-blas.a"  || true
fi

echo "==> Done. Installed archives:"
ls -1 "$DEST"
