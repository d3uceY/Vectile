//go:build !shared_lib
// +build !shared_lib

// Static-mode CGO include flags.
//
// This is the default build mode for llama-go: the static archives
// (libbinding.a, libllama-common.a, libllama-common-base.a, libllama.a,
// libggml*.a) are linked into the consuming binary, so no shared libraries are
// required at runtime for the llama.cpp side. The archives are platform-specific
// and are kept in per-OS subdirectories (windows/linux/darwin); the OS-specific
// linker flags live in linkage_windows.go / linkage_linux.go / linkage_darwin.go.
//
// Only the include search paths are shared here: they are OS-agnostic because the
// headers (llama.cpp/*, cgo_headers/*) are identical across platforms.
//
// The include directories are resolved by cgo relative to this package directory,
// so the -I paths point into ./llama.cpp and ./cgo_headers in the vendored root.
//
// Shared mode (go build -tags shared_lib) is still configured separately in
// linkage_shared.go; vectile builds with static linkage.

package llama

/*
#cgo CFLAGS: -I./ -I./llama.cpp -I./llama.cpp/include -I./llama.cpp/ggml/include -I./llama.cpp/common -I./llama.cpp/vendor -I./cgo_headers -I./cgo_headers/llama.cpp -I./cgo_headers/llama.cpp/include -I./cgo_headers/llama.cpp/ggml/include -I./cgo_headers/llama.cpp/common -I./cgo_headers/llama.cpp/thirdparty
#cgo CXXFLAGS: -std=c++17 -I./ -I./llama.cpp -I./llama.cpp/include -I./llama.cpp/ggml/include -I./llama.cpp/common -I./llama.cpp/vendor -I./cgo_headers -I./cgo_headers/llama.cpp -I./cgo_headers/llama.cpp/include -I./cgo_headers/llama.cpp/ggml/include -I./cgo_headers/llama.cpp/common -I./cgo_headers/llama.cpp/thirdparty
*/
import "C"
