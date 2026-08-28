//go:build windows

package indexer

import (
	"os/exec"
	"syscall"
)

// hideWindow keeps a child console process (e.g. git) from flashing a
// terminal window when launched from the GUI app on Windows.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
