package services

import (
	"fmt"
	"sort"

	"vectile/backend/config"
	"vectile/backend/db"
	"vectile/backend/indexer"
	"vectile/backend/startup"
)

// IndexService exposes configuration, indexing, and pruning to the frontend.
type IndexService struct{ core *Core }

// NewIndexService creates an IndexService bound to the shared core.
func NewIndexService(core *Core) *IndexService { return &IndexService{core: core} }

// GetConfig returns the current configuration.
func (s *IndexService) GetConfig() *config.Config { return s.core.Cfg }

// SetConfig saves the configuration and applies its side effects
// (start-on-login). Auto-reindex is read live by the loop in main.
func (s *IndexService) SetConfig(cfg config.Config) error {
	if err := config.Save(&cfg, s.core.CfgPath); err != nil {
		return err
	}
	s.core.Cfg = &cfg
	s.applyStartup(cfg.GUI.StartOnLogin)
	return nil
}

// AddSourcePath adds a source path. kind is "vault", "calibre", "project", or
// "repo"; name is the collection name for project/repo (ignored otherwise).
func (s *IndexService) AddSourcePath(kind, name, path string) error {
	cfg := s.core.Cfg
	switch kind {
	case "vault":
		cfg.ObsidianVaults = appendUnique(cfg.ObsidianVaults, path)
	case "calibre":
		cfg.CalibreLibraries = appendUnique(cfg.CalibreLibraries, path)
	case "project":
		cfg.Projects[name] = appendUnique(cfg.Projects[name], path)
	case "repo":
		cfg.Repositories[name] = appendUnique(cfg.Repositories[name], path)
	default:
		return fmt.Errorf("unknown source kind %q", kind)
	}
	return s.persistConfig()
}

// RemoveSourcePath removes a source path from a config section.
func (s *IndexService) RemoveSourcePath(kind, name, path string) error {
	cfg := s.core.Cfg
	switch kind {
	case "vault":
		cfg.ObsidianVaults = removeStr(cfg.ObsidianVaults, path)
	case "calibre":
		cfg.CalibreLibraries = removeStr(cfg.CalibreLibraries, path)
	case "project":
		cfg.Projects[name] = removeStr(cfg.Projects[name], path)
	case "repo":
		cfg.Repositories[name] = removeStr(cfg.Repositories[name], path)
	default:
		return fmt.Errorf("unknown source kind %q", kind)
	}
	return s.persistConfig()
}

// ToggleCollectionEnabled enables/disables a collection for indexing.
func (s *IndexService) ToggleCollectionEnabled(name string, enabled bool) error {
	cfg := s.core.Cfg
	cfg.DisabledCollections = removeStr(cfg.DisabledCollections, name)
	if !enabled {
		cfg.DisabledCollections = append(cfg.DisabledCollections, name)
	}
	return s.persistConfig()
}

// IndexCollection starts indexing one collection in the background, emitting
// indexing:progress and indexing:complete events.
func (s *IndexService) IndexCollection(name string, force bool) {
	go func() {
		if !s.lockIndex() {
			return
		}
		defer s.unlockIndex()
		s.runIndex(name, force)
	}()
}

// IndexAll starts pruning + indexing every enabled, configured collection.
func (s *IndexService) IndexAll(force bool) {
	go func() {
		if !s.lockIndex() {
			return
		}
		defer s.unlockIndex()
		if pr := indexer.PruneAll(db.DB, s.core.Cfg); pr.Pruned > 0 {
			s.core.App.Event.Emit("indexing:pruned", pr.Pruned)
		}
		for _, name := range s.configuredCollections() {
			s.runIndex(name, force)
		}
	}()
}

// Prune removes stale sources from a collection ("all" or "" for everything).
func (s *IndexService) Prune(name string) (indexer.PruneResult, error) {
	if name == "" || name == "all" {
		return *indexer.PruneAll(db.DB, s.core.Cfg), nil
	}
	return *indexer.PruneCollection(db.DB, s.core.Cfg, name), nil
}

// IsIndexing reports whether an index run is in progress.
func (s *IndexService) IsIndexing() bool {
	s.core.indexMu.Lock()
	defer s.core.indexMu.Unlock()
	return s.core.indexing
}

func (s *IndexService) lockIndex() bool {
	s.core.indexMu.Lock()
	defer s.core.indexMu.Unlock()
	if s.core.indexing {
		return false
	}
	s.core.indexing = true
	return true
}

func (s *IndexService) unlockIndex() {
	s.core.indexMu.Lock()
	s.core.indexing = false
	s.core.indexMu.Unlock()
}

// runIndex dispatches one collection to its indexer and emits progress events.
func (s *IndexService) runIndex(name string, force bool) {
	cfg := s.core.Cfg
	progress := func(current, total int, item string) {
		s.core.App.Event.Emit("indexing:progress", IndexProgress{
			Collection: name, Current: current, Total: total, Item: item,
		})
	}

	var result *indexer.IndexResult
	switch {
	case name == "obsidian":
		result = indexer.IndexObsidian(db.DB, cfg, force, progress, s.core.Embedder)
	case name == "calibre":
		result = indexer.IndexCalibre(db.DB, cfg, force, progress, s.core.Embedder)
	case len(cfg.Repositories[name]) > 0:
		agg := &indexer.IndexResult{}
		for _, repo := range indexer.ResolveRepoPaths(cfg.Repositories[name]) {
			agg.Merge(indexer.IndexGitRepo(db.DB, cfg, repo, name, force,
				cfg.GitHistoryInMonths > 0, progress, s.core.Embedder))
		}
		result = agg
	case len(cfg.Projects[name]) > 0:
		result = indexer.IndexProject(db.DB, cfg, name, cfg.Projects[name], force, progress, s.core.Embedder)
	default:
		result = &indexer.IndexResult{Errors: 1, ErrorMessages: []string{"collection not configured: " + name}}
	}

	s.core.App.Event.Emit("indexing:complete", IndexComplete{
		Collection: name,
		Indexed:    result.Indexed,
		Skipped:    result.Skipped,
		Errors:     result.Errors,
		Messages:   result.ErrorMessages,
	})
}

// configuredCollections returns the enabled, configured collections in a
// deterministic order: system (obsidian, calibre), then repos, then projects.
func (s *IndexService) configuredCollections() []string {
	cfg := s.core.Cfg
	var names []string
	if cfg.IsCollectionEnabled("obsidian") && len(cfg.ObsidianVaults) > 0 {
		names = append(names, "obsidian")
	}
	if cfg.IsCollectionEnabled("calibre") && len(cfg.CalibreLibraries) > 0 {
		names = append(names, "calibre")
	}
	repos := sortedKeys(cfg.Repositories)
	for _, n := range repos {
		if cfg.IsCollectionEnabled(n) {
			names = append(names, n)
		}
	}
	projects := sortedKeys(cfg.Projects)
	for _, n := range projects {
		if cfg.IsCollectionEnabled(n) {
			names = append(names, n)
		}
	}
	return names
}

func (s *IndexService) persistConfig() error {
	if err := config.Save(s.core.Cfg, s.core.CfgPath); err != nil {
		return err
	}
	s.core.Cfg.ResetDisabledCache()
	return nil
}

func (s *IndexService) applyStartup(enabled bool) {
	cur, err := startup.IsEnabled()
	if err != nil {
		return
	}
	if enabled && !cur {
		_ = startup.Enable()
	}
	if !enabled && cur {
		_ = startup.Disable()
	}
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}

func removeStr(list []string, v string) []string {
	out := list[:0]
	for _, x := range list {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}
