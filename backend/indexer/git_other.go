//go:build !windows

package indexer

import "os/exec"

// hideWindow is a no-op on Unix: child processes launched from a GUI app
// never spawn a visible console window there.
func hideWindow(cmd *exec.Cmd) {}
