//go:build windows

package startup

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func shortcutPath() (string, error) {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return "", errors.New("APPDATA environment variable not set")
	}
	return filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "vectile.lnk"), nil
}

func enable() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	shortcut, err := shortcutPath()
	if err != nil {
		return err
	}

	ps := fmt.Sprintf(`
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("%s")
$Shortcut.TargetPath = "%s"
$Shortcut.Save()
`, shortcut, exePath)

	cmd := exec.Command("powershell", "-NoProfile", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}

func disable() error {
	shortcut, err := shortcutPath()
	if err != nil {
		return err
	}
	if err := os.Remove(shortcut); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func isEnabled() (bool, error) {
	shortcut, err := shortcutPath()
	if err != nil {
		return false, err
	}
	_, err = os.Stat(shortcut)
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}
