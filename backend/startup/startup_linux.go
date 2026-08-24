//go:build linux

package startup

import (
	"fmt"
	"os"
	"path/filepath"
)

const desktopFileContent = `[Desktop Entry]
Type=Application
Name=vectile
Comment=Private local search
Exec=%s
X-GNOME-Autostart-enabled=true
Terminal=false
Categories=Utility;
`

func autostartPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "autostart", "vectile.desktop")
}

func enable() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	path := autostartPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(fmt.Sprintf(desktopFileContent, exePath)), 0o644)
}

func disable() error {
	path := autostartPath()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func isEnabled() (bool, error) {
	_, err := os.Stat(autostartPath())
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}
