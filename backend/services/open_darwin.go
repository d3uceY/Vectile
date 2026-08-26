//go:build darwin

package services

import "os/exec"

// openPath opens a file or folder with the OS default handler.
func openPath(path string) error {
	return exec.Command("open", path).Start()
}

// revealPath selects a file in Finder.
func revealPath(path string) error {
	return exec.Command("open", "-R", path).Start()
}
