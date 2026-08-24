// Package services exposes the vectile backend to the frontend as Wails v3
// services: status/library data, hybrid search, and config + indexing.
package services

import (
	"context"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"

	"vectile/backend/config"
	"vectile/backend/embeddings"
)

// Version is injected at build time via -ldflags; defaults to "dev".
var Version = "dev"

// Core holds the shared runtime state for all services.
type Core struct {
	Cfg      *config.Config
	CfgPath  string
	Embedder *embeddings.Embedder
	App      *application.App

	indexMu  sync.Mutex // serializes index/prune runs
	indexing bool

	// cancelMu guards the active run's cancel func, so the user can abort an
	// index from the frontend between batches.
	cancelMu sync.Mutex
	cancel   context.CancelFunc
}

// newIndexContext creates a cancellable context for a new index run and
// registers its cancel func for CancelIndexing.
func (c *Core) newIndexContext() context.Context {
	ctx, cancel := context.WithCancel(context.Background())
	c.cancelMu.Lock()
	c.cancel = cancel
	c.cancelMu.Unlock()
	return ctx
}

// clearIndexContext drops the active cancel func once a run finishes.
func (c *Core) clearIndexContext() {
	c.cancelMu.Lock()
	c.cancel = nil
	c.cancelMu.Unlock()
}

// cancelIndex aborts the active index run, if any, and reports whether one
// was running.
func (c *Core) cancelIndex() bool {
	c.cancelMu.Lock()
	defer c.cancelMu.Unlock()
	if c.cancel == nil {
		return false
	}
	c.cancel()
	return true
}

// Status is the app-wide status summary shown in the UI.
type Status struct {
	Collections int              `json:"collections"`
	Sources     int              `json:"sources"`
	Chunks      int              `json:"chunks"`
	DBSize      int64            `json:"dbSize"`
	ModelState  embeddings.State `json:"modelState"`
	ModelName   string           `json:"modelName"`
	ModelPath   string           `json:"modelPath"`
	ModelError  string           `json:"modelError"`
}

// Collection is a library collection with counts and enabled state.
type Collection struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Sources     int    `json:"sources"`
	Chunks      int    `json:"chunks"`
	Created     string `json:"created"`
	Enabled     bool   `json:"enabled"`
}

// Source is one indexed source.
type Source struct {
	ID           int64  `json:"id"`
	CollectionID int64  `json:"collectionId"`
	SourceType   string `json:"sourceType"`
	Path         string `json:"path"`
	Chunks       int    `json:"chunks"`
	LastIndexed  string `json:"lastIndexed"`
}

// Document is one chunked document (a browse leaf).
type Document struct {
	ID           int64  `json:"id"`
	SourceID     int64  `json:"sourceId"`
	CollectionID int64  `json:"collectionId"`
	ChunkIndex   int    `json:"chunkIndex"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	Metadata     any    `json:"metadata"`
}

// IndexProgress is emitted during an index run.
type IndexProgress struct {
	Collection string `json:"collection"`
	Current    int    `json:"current"`
	Total      int    `json:"total"`
	Item       string `json:"item"`
}

// IndexComplete is emitted when an index run finishes.
type IndexComplete struct {
	Collection string   `json:"collection"`
	Indexed    int      `json:"indexed"`
	Skipped    int      `json:"skipped"`
	Errors     int      `json:"errors"`
	Messages   []string `json:"messages"`
}

// IndexFileProgress is emitted per successfully indexed file during a run,
// scoped to the collection being indexed so the frontend can increment its
// per-collection file count.
type IndexFileProgress struct {
	Collection string `json:"collection"`
	File       string `json:"file"`
	Indexed    int    `json:"indexed"`
	Total      int    `json:"total"`
}

// IndexCancelled is emitted when an index run is cancelled by the user.
type IndexCancelled struct {
	Collection string `json:"collection"`
	Indexed    int    `json:"indexed"`
	Skipped    int    `json:"skipped"`
	Errors     int    `json:"errors"`
}
