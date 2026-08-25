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

// Version is stamped at release time via `-ldflags "-X main.Version=vX.Y.Z"`.
// Keep it a var (not a const) so the linker can override it.
var Version = "v0.1.0"

func main() {
	// Expose the build-time version to the frontend (AppService.GetVersion).
	services.Version = Version

	// Resolve the app-data directory first so config, db/, and models/ have a
	// home. The embedding model is expected to already be in models/.
	if _, err := appdata.Init(); err != nil {
		log.Fatalf("appdata init: %v", err)
	}

	cfg, err := config.Load(appdata.ConfigPath())
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	modelPath := cfg.ActiveModel
	if modelPath == "" {
		modelPath = appdata.ModelPath()
	}

	core := &services.Core{
		Cfg:      cfg,
		CfgPath:  appdata.ConfigPath(),
		Embedder: embeddings.NewEmbedder(modelPath, 0, 0),
	}

	app := application.New(application.Options{
		Name:        "vectile",
		Description: "A local, private search across everything you've written, read, and kept.",
		Services: []application.Service{
			application.NewService(services.NewAppService(core)),
			application.NewService(services.NewSearchService(core)),
			application.NewService(services.NewIndexService(core)),
			application.NewService(services.NewModelService(core)),
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

	// Reconcile the models folder and load the active model (or the default)
	// with its per-model settings, rebuilding the vector tables if the
	// active model's embedding dimension changed.
	if err := services.NewModelService(core).ApplyActiveModel(); err != nil {
		log.Fatalf("apply active model: %v", err)
	}

	// Auto-reindex: poll the config each minute; fire an index-all when the
	// interval has elapsed. Shares the same mutex as manual index runs. The
	// loop reads core.Cfg live so settings changes apply without a restart.
	go autoReindexLoop(core)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}

	parser.ClosePDFPool()
	core.Embedder.Close()
	_ = db.Close()
}

// autoReindexLoop reads core.Cfg live so settings changes (auto-reindex toggle
// and interval) take effect on the next tick without restarting the loop.
func autoReindexLoop(core *services.Core) {
	svc := services.NewIndexService(core)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	var last time.Time
	for range ticker.C {
		c := core.Cfg
		if !c.GUI.AutoReindex {
			continue
		}
		interval := time.Duration(c.GUI.AutoReindexIntervalMinutes) * time.Minute
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
