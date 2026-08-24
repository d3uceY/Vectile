package indexer

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"vectile/backend/config"
	"vectile/backend/db"
	"vectile/backend/parser"
)

// PruneResult summarises a pruning run.
type PruneResult struct {
	Pruned        int      `json:"pruned"`
	Checked       int      `json:"checked"`
	Errors        int      `json:"errors"`
	ErrorMessages []string `json:"errorMessages"`
}

func (r *PruneResult) String() string {
	return fmt.Sprintf("Pruned: %d, Checked: %d, Errors: %d", r.Pruned, r.Checked, r.Errors)
}

// Merge adds another result into this one.
func (r *PruneResult) Merge(other *PruneResult) {
	r.Pruned += other.Pruned
	r.Checked += other.Checked
	r.Errors += other.Errors
	r.ErrorMessages = append(r.ErrorMessages, other.ErrorMessages...)
}

// sourceInfo holds basic info about an indexed source row.
type sourceInfo struct {
	ID         int64
	SourcePath string
	SourceType string
}

// sourcesForCollection returns all sources for a collection.
func sourcesForCollection(conn *sql.DB, collectionID int64) ([]sourceInfo, error) {
	rows, err := conn.Query(
		"SELECT id, source_path, source_type FROM sources WHERE collection_id = ?",
		collectionID,
	)
	if err != nil {
		return nil, fmt.Errorf("query sources: %w", err)
	}
	defer rows.Close()

	var sources []sourceInfo
	for rows.Next() {
		var s sourceInfo
		if err := rows.Scan(&s.ID, &s.SourcePath, &s.SourceType); err != nil {
			continue
		}
		sources = append(sources, s)
	}
	return sources, rows.Err()
}

// finishPrune bulk-deletes the collected stale source IDs in a single
// transaction. Batching is essential: deleting sources one at a time
// re-scans the vec0 tables per source.
func finishPrune(conn *sql.DB, result *PruneResult, stale []int64, kind string) {
	if len(stale) == 0 {
		return
	}
	slog.Info("pruning stale sources", "kind", kind, "count", len(stale))
	if err := db.PruneSources(conn, stale); err != nil {
		result.Errors++
		result.ErrorMessages = append(result.ErrorMessages, err.Error())
		return
	}
	result.Pruned += len(stale)
}

// PruneAll prunes stale sources from all collections.
func PruneAll(conn *sql.DB, cfg *config.Config) *PruneResult {
	result := &PruneResult{}

	rows, err := conn.Query("SELECT id, name, collection_type FROM collections")
	if err != nil {
		result.Errors++
		result.ErrorMessages = append(result.ErrorMessages, err.Error())
		return result
	}
	defer rows.Close()

	type collInfo struct {
		id    int64
		name  string
		ctype string
	}
	var collections []collInfo
	for rows.Next() {
		var c collInfo
		if rows.Scan(&c.id, &c.name, &c.ctype) == nil {
			collections = append(collections, c)
		}
	}

	for _, c := range collections {
		result.Merge(pruneCollectionByType(conn, cfg, c.id, c.name, c.ctype))
	}

	// Clean up any embeddings whose document no longer exists.
	if n, err := db.DeleteOrphanedVectors(conn); err == nil && n > 0 {
		slog.Info("removed orphaned vectors", "count", n)
	}
	return result
}

// PruneCollection prunes stale sources from a single named collection.
func PruneCollection(conn *sql.DB, cfg *config.Config, collectionName string) *PruneResult {
	var id int64
	var ctype string
	err := conn.QueryRow(
		"SELECT id, collection_type FROM collections WHERE name = ?", collectionName,
	).Scan(&id, &ctype)
	if err != nil {
		return &PruneResult{} // collection doesn't exist yet, nothing to prune
	}
	return pruneCollectionByType(conn, cfg, id, collectionName, ctype)
}

func pruneCollectionByType(conn *sql.DB, cfg *config.Config, collectionID int64, name, ctype string) *PruneResult {
	switch name {
	case "obsidian":
		return pruneFileSources(conn, collectionID)
	case "calibre":
		return pruneCalibreSources(conn, cfg, collectionID)
	default:
		switch ctype {
		case "project":
			return pruneFileSources(conn, collectionID)
		case "code":
			return pruneCodeSources(conn, collectionID)
		default:
			return &PruneResult{}
		}
	}
}

// pruneFileSources removes sources whose file paths no longer exist on disk.
// URI-style paths (calibre://, git://) are skipped.
func pruneFileSources(conn *sql.DB, collectionID int64) *PruneResult {
	result := &PruneResult{}

	sources, err := sourcesForCollection(conn, collectionID)
	if err != nil {
		result.Errors++
		result.ErrorMessages = append(result.ErrorMessages, err.Error())
		return result
	}

	var stale []int64
	for _, s := range sources {
		if strings.Contains(s.SourcePath, "://") {
			continue
		}
		result.Checked++
		if _, err := os.Stat(s.SourcePath); os.IsNotExist(err) {
			stale = append(stale, s.ID)
		}
	}
	finishPrune(conn, result, stale, "file")
	return result
}

// pruneCalibreSources removes indexed books that no longer exist in Calibre.
func pruneCalibreSources(conn *sql.DB, cfg *config.Config, collectionID int64) *PruneResult {
	result := &PruneResult{}

	type bookKey struct {
		libraryPath  string
		relativePath string
	}
	currentBooks := make(map[bookKey]bool)

	for _, lib := range cfg.CalibreLibraries {
		lib = expandPath(lib)
		books, err := parser.ParseCalibreLibrary(lib)
		if err != nil {
			slog.Warn("prune calibre: cannot read Calibre library, skipping prune", "path", lib, "err", err)
			return result // safety: don't prune if we can't read the source
		}
		for _, b := range books {
			currentBooks[bookKey{lib, b.RelativePath}] = true
		}
	}

	sources, err := sourcesForCollection(conn, collectionID)
	if err != nil {
		result.Errors++
		result.ErrorMessages = append(result.ErrorMessages, err.Error())
		return result
	}

	var stale []int64
	for _, s := range sources {
		result.Checked++
		if strings.HasPrefix(s.SourcePath, "calibre://") {
			rest := s.SourcePath[len("calibre://"):]
			found := false
			for _, lib := range cfg.CalibreLibraries {
				lib = expandPath(lib)
				if strings.HasPrefix(rest, lib+"/") {
					relPath := rest[len(lib)+1:]
					if currentBooks[bookKey{lib, relPath}] {
						found = true
						break
					}
				}
			}
			if !found {
				stale = append(stale, s.ID)
			}
		} else {
			if _, err := os.Stat(s.SourcePath); os.IsNotExist(err) {
				stale = append(stale, s.ID)
			}
		}
	}
	finishPrune(conn, result, stale, "calibre")
	return result
}

// pruneCodeSources removes stale code files from code collections. Commit
// history (git:// URIs) is never pruned — those commits happened and remain
// valid reference material.
func pruneCodeSources(conn *sql.DB, collectionID int64) *PruneResult {
	result := &PruneResult{}

	sources, err := sourcesForCollection(conn, collectionID)
	if err != nil {
		result.Errors++
		result.ErrorMessages = append(result.ErrorMessages, err.Error())
		return result
	}

	var stale []int64
	for _, s := range sources {
		if strings.HasPrefix(s.SourcePath, "git://") {
			continue
		}
		result.Checked++
		if _, err := os.Stat(s.SourcePath); os.IsNotExist(err) {
			stale = append(stale, s.ID)
		}
	}
	finishPrune(conn, result, stale, "code")
	return result
}
