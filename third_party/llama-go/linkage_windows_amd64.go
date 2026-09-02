//go:build windows && amd64 && !shared_lib
// +build windows,amd64,!shared_lib

// Static-mode link flags for Windows amd64 (MinGW-w64).
//
// The archives in ./windows/amd64 are MinGW/COFF builds. cgo resolves the -L
// path relative to this package directory, so the archived libs are found here.
// -Wl,--start-group/--end-group is used because libllama-common, libllama and
// the libggml-* archives have cross-references the linker can't resolve in a
// single pass. The MinGW runtime (libgcc_s, libstdc++, libwinpthread, libgomp,
// libdl) is supplied by the MinGW toolchain at link time and shipped as DLLs
// beside the executable at runtime.

package llama

/*
#cgo LDFLAGS: -L./windows/amd64 -Wl,--start-group -lbinding -lllama-common -lllama-common-base -lllama -lggml-cpu -lggml -lggml-base -Wl,--end-group -lstdc++ -lm -lgomp
*/
import "C"
