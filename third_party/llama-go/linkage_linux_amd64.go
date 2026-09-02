//go:build linux && amd64 && !shared_lib
// +build linux,amd64,!shared_lib

// Static-mode link flags for Linux amd64 (gcc/clang, ELF).
//
// The archives in ./linux/amd64 are ELF builds. cgo resolves the -L path
// relative to this package directory, so the archived libs are found here.
// -lgomp pulls in the GCC OpenMP runtime (libgomp.so.1), which is a runtime
// dependency: bundle it in the AppImage and declare it (libgomp1) in the .deb.
// libstdc++ is the C++ runtime, resolved at runtime on most desktop distros.
//
// -Wl,--start-group/--end-group is used because libllama-common, libllama and
// the libggml-* archives have cross-references the linker can't resolve in a
// single pass.

package llama

/*
#cgo LDFLAGS: -L./linux/amd64 -Wl,--start-group -lbinding -lllama-common -lllama-common-base -lllama -lggml-cpu -lggml -lggml-base -Wl,--end-group -lstdc++ -lm -lgomp
*/
import "C"
