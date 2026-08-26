//go:build linux

package services

import (
	"os/exec"
	"path/filepath"
)

// openPath opens a file or folder with the OS default handler.
func openPath(path string) error {
	return exec.Command("xdg-open", path).Start()
}

// revealPath opens the parent folder in the file manager (no reliable
// "select this file" exists across Linux desktops).
func revealPath(path string) error {
	return exec.Command("xdg-open", filepath.Dir(path)).Start()
}
