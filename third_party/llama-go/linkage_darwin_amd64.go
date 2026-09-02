//go:build darwin && amd64 && !shared_lib
// +build darwin,amd64,!shared_lib

// Static-mode link flags for macOS amd64 (Intel, clang, Mach-O).
//
// The archives in ./darwin/amd64 are x86_64 Mach-O builds and include the Metal
// + BLAS backends (libggml-metal, libggml-blas). cgo resolves the -L path
// relative to this package directory, so the archived libs are found here.
// Apple's ld64 has no --start-group/--end-group (it re-searches archives
// automatically) and no libgomp, so darwin gets its own flags. The system
// frameworks (Accelerate, Foundation, Metal, MetalKit, MetalPerformanceShaders)
// are provided by the OS, so nothing needs to be shipped alongside the app.

package llama

/*
#cgo LDFLAGS: -L./darwin/amd64 -lbinding -lllama-common -lllama-common-base -lllama -lggml-cpu -lggml -lggml-base -lggml-metal -lggml-blas -lstdc++ -lm -framework Accelerate -framework Foundation -framework Metal -framework MetalKit -framework MetalPerformanceShaders
*/
import "C"
