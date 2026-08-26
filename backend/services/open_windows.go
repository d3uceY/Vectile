//go:build windows

package services

import (
	"os"
	"os/exec"
)

// openPath opens a file or folder with the OS default handler.
func openPath(path string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", path).Start()
}

// revealPath selects a file in Explorer; a folder opens in Explorer directly.
func revealPath(path string) error {
	if fi, err := os.Stat(path); err == nil && fi.IsDir() {
		return exec.Command("explorer", path).Start()
	}
	return exec.Command("explorer", "/select,"+path).Start()
}
