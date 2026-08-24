//go:build darwin

package startup

import (
	"fmt"
	"os"
	"path/filepath"
)

func plistPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", "com.vectile.app.plist")
}

func enable() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	path := plistPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>com.vectile.app</string>
	<key>ProgramArguments</key>
	<array><string>%s</string></array>
	<key>RunAtLoad</key><true/>
</dict>
</plist>
`, exePath)
	return os.WriteFile(path, []byte(plist), 0o644)
}

func disable() error {
	path := plistPath()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func isEnabled() (bool, error) {
	_, err := os.Stat(plistPath())
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}
