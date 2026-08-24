// Package startup manages launch-at-login via platform mechanisms: a Startup
// folder shortcut on Windows, a launchd LaunchAgent on macOS, and a
// ~/.config/autostart desktop entry on Linux.
package startup

// Enable registers the app to launch at login.
func Enable() error { return enable() }

// Disable removes the launch-at-login registration.
func Disable() error { return disable() }

// IsEnabled reports whether launch-at-login is currently registered.
func IsEnabled() (bool, error) { return isEnabled() }
