package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	"vectile/backend/appdata"
	"vectile/backend/db"
)

// AppService reports app/status/library data.
type AppService struct{ core *Core }

// NewAppService creates an AppService bound to the shared core.
func NewAppService(core *Core) *AppService { return &AppService{core: core} }

// GetVersion returns the app version.
func (s *AppService) GetVersion() string { return Version }

// GetPlatform returns the OS ("windows", "darwin", "linux").
func (s *AppService) GetPlatform() string { return runtime.GOOS }

// GetCPUCount returns the number of logical CPUs available to the process —
// the ceiling the Settings UI uses for the model's CPU-threads slider
// (0 = use all of them).
func (s *AppService) GetCPUCount() int { return runtime.NumCPU() }

// GetStatus returns the status summary: library stats + model state.
func (s *AppService) GetStatus() Status {
	var collections, sources, chunks int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM collections").Scan(&collections)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM sources").Scan(&sources)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM documents").Scan(&chunks)

	var size int64
	if info, err := os.Stat(appdata.DBPath()); err == nil {
		size = info.Size()
	}


	var lastIndexed sql.NullString
	_ = db.DB.QueryRow(`SELECT MAX(last_indexed_at) FROM sources
		WHERE last_indexed_at IS NOT NULL AND last_indexed_at != ''`).Scan(&lastIndexed)

	modelErr := ""
	if err := s.core.Embedder.LoadError(); err != nil {
		modelErr = err.Error()
	}
	modelName := s.core.Cfg.EmbeddingModel
	if active, ok, err := db.GetActiveModel(db.DB); err == nil && ok {
		modelName = active.Name
		if active.Dimensions > 0 {
			modelName = fmt.Sprintf("%s · %dd", active.Name, active.Dimensions)
		}
	}
	return Status{
		Collections: collections,
		Sources:     sources,
		Chunks:      chunks,
		DBSize:      size,
		ModelState:  s.core.Embedder.State(),
		ModelName:   modelName,
		ModelPath:   s.core.Embedder.ModelPath(),
		ModelError:  modelErr,
		LastIndexed: lastIndexed.String,
	}
}

// ListCollections returns all indexed collections with counts, ordered by name.
func (s *AppService) ListCollections() ([]Collection, error) {
	rows, err := db.DB.Query(`
		SELECT c.id, c.name, c.collection_type, c.description, c.created_at,
			(SELECT COUNT(*) FROM sources s WHERE s.collection_id = c.id),
			(SELECT COUNT(*) FROM documents d WHERE d.collection_id = c.id),
			(SELECT MAX(s2.last_indexed_at) FROM sources s2
			  WHERE s2.collection_id = c.id AND s2.last_indexed_at IS NOT NULL AND s2.last_indexed_at != ''),
			CASE WHEN EXISTS(SELECT 1 FROM documents d WHERE d.collection_id = c.id)
			      AND NOT EXISTS(SELECT 1 FROM documents d JOIN vec_documents v
			                     ON v.document_id = d.id WHERE d.collection_id = c.id)
			     THEN 1 ELSE 0 END
		FROM collections c
		ORDER BY c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Collection
	for rows.Next() {
		var c Collection
		var desc, created, last sql.NullString
		var needsReindex int
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &desc, &created, &c.Sources, &c.Chunks, &last, &needsReindex); err != nil {
			return nil, err
		}
		if desc.Valid {
			c.Description = desc.String
		}
		if created.Valid {
			c.Created = created.String
		}
		c.LastIndexed = last.String
		c.NeedsReindex = needsReindex == 1
		c.Enabled = s.core.Cfg.IsCollectionEnabled(c.Name)
		out = append(out, c)
	}
	return out, rows.Err()
}

// ListSources returns the sources of a collection, ordered by path.
func (s *AppService) ListSources(collectionID int64) ([]Source, error) {
	rows, err := db.DB.Query(`
		SELECT s.id, s.collection_id, s.source_type, s.source_path,
			(SELECT COUNT(*) FROM documents d WHERE d.source_id = s.id),
			s.last_indexed_at
		FROM sources s
		WHERE s.collection_id = ?
		ORDER BY s.source_path`, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Source
	for rows.Next() {
		var src Source
		var last sql.NullString
		if err := rows.Scan(&src.ID, &src.CollectionID, &src.SourceType, &src.Path, &src.Chunks, &last); err != nil {
			return nil, err
		}
		if last.Valid {
			src.LastIndexed = last.String
		}
		out = append(out, src)
	}
	return out, rows.Err()
}

// ListDocuments returns the documents of a collection (optionally one source).
func (s *AppService) ListDocuments(collectionID, sourceID int64) ([]Document, error) {
	query := `SELECT id, source_id, collection_id, chunk_index, title, content, metadata
		FROM documents WHERE collection_id = ?`
	args := []any{collectionID}
	if sourceID > 0 {
		query += ` AND source_id = ?`
		args = append(args, sourceID)
	}
	query += ` ORDER BY source_id, chunk_index`

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Document
	for rows.Next() {
		var d Document
		var title, meta sql.NullString
		var content string
		if err := rows.Scan(&d.ID, &d.SourceID, &d.CollectionID, &d.ChunkIndex, &title, &content, &meta); err != nil {
			return nil, err
		}
		if title.Valid {
			d.Title = title.String
		}
		d.Content = content
		d.Metadata = parseMeta(meta)
		out = append(out, d)
	}
	return out, rows.Err()
}

// GetModelError returns the embedder's load error (for the status pill).
func (s *AppService) GetModelError() string {
	if err := s.core.Embedder.LoadError(); err != nil {
		return err.Error()
	}
	return ""
}

// OpenFile opens a file or folder with the OS default application.
func (s *AppService) OpenFile(path string) error {
	if err := ensurePathExists(path); err != nil {
		return err
	}
	return openPath(path)
}

// RevealInFolder selects a file in the OS file manager (opens the parent
// folder for a directory).
func (s *AppService) RevealInFolder(path string) error {
	if err := ensurePathExists(path); err != nil {
		return err
	}
	return revealPath(path)
}

// ensurePathExists guards the open/reveal helpers so a stale indexed path
// gets a useful error instead of a silent no-op.
func ensurePathExists(path string) error {
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("path not found: %s", path)
	}
	return nil
}

// parseMeta decodes a JSON metadata column into a value the frontend can use.
func parseMeta(ns sql.NullString) any {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(ns.String), &m); err != nil {
		return ns.String
	}
	return m
}
