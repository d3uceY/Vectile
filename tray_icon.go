package main

import _ "embed"

// The tray icon is the vectile logo PNG on every platform. On Windows this
// must NOT be an .ico: Wails v3 beta.6's CreateSmallHIconFromImage feeds the
// whole .ico file (with its ICONDIR header) to CreateIconFromResourceEx, which
// expects a single image resource, so an .ico yields a NULL handle and the tray
// silently falls back to the app icon. A PNG loads cleanly (verified), and
// macOS/Linux consume PNG natively.
//
//go:embed frontend/public/vectile-logo.png
var trayIcon []byte

// trayIconBytes returns the system-tray icon for the current platform.
func trayIconBytes() []byte { return trayIcon }
