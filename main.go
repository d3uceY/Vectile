package main

import (
	"embed"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"vectile/backend/appdata"
	"vectile/backend/config"
	"vectile/backend/db"
	"vectile/backend/embeddings"
	"vectile/backend/parser"
	"vectile/backend/services"
	"vectile/backend/startup"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Resolve the app-data directory first so config, db/, and models/ have a
	// home. The embedding model is expected to already be in models/.
	if _, err := appdata.Init(); err != nil {
		log.Fatalf("appdata init: %v", err)
	}

	cfg, err := config.Load(appdata.ConfigPath())
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	core := &services.Core{
		Cfg:      cfg,
		CfgPath:  appdata.ConfigPath(),
		Embedder: embeddings.NewEmbedder(appdata.ModelPath()),
	}

	app := application.New(application.Options{
		Name:        "vectile",
		Description: "A local, private search across everything you've written, read, and kept.",
		Services: []application.Service{
			application.NewService(services.NewAppService(core)),
			application.NewService(services.NewSearchService(core)),
			application.NewService(services.NewIndexService(core)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	core.App = app

	if cfg.GUI.StartOnLogin {
		if enabled, _ := startup.IsEnabled(); !enabled {
			_ = startup.Enable()
		}
	}

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "vectile",
		Width:     1180,
		Height:    760,
		MinWidth:  900,
		MinHeight: 600,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(251, 252, 255),
		URL:              "/",
	})

	// Open the database and apply the schema once the app is wired up.
	if err := db.Open(appdata.DBPath()); err != nil {
		log.Fatalf("db open: %v", err)
	}

	// Auto-reindex: poll the config each minute; fire an index-all when the
	// interval has elapsed. Shares the same mutex as manual index runs.
	go autoReindexLoop(cfg, core)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}

	parser.ClosePDFPool()
	core.Embedder.Close()
	_ = db.Close()
}

// autoReindexLoop reads the config live so settings changes take effect on the
// next tick without restarting the loop.
func autoReindexLoop(cfg *config.Config, core *services.Core) {
	svc := services.NewIndexService(core)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	var last time.Time
	for range ticker.C {
		if !cfg.GUI.AutoReindex {
			continue
		}
		interval := time.Duration(cfg.GUI.AutoReindexIntervalMinutes) * time.Minute
		if interval < time.Minute {
			interval = time.Minute
		}
		if !last.IsZero() && time.Since(last) < interval {
			continue
		}
		last = time.Now()
		svc.IndexAll(false)
	}
}
