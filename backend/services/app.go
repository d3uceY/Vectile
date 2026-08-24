package services

import (
	"database/sql"
	"encoding/json"
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

	modelErr := ""
	if err := s.core.Embedder.LoadError(); err != nil {
		modelErr = err.Error()
	}
	return Status{
		Collections: collections,
		Sources:     sources,
		Chunks:      chunks,
		DBSize:      size,
		ModelState:  s.core.Embedder.State(),
		ModelName:   s.core.Cfg.EmbeddingModel + " · 1024d",
		ModelPath:   s.core.Embedder.ModelPath(),
		ModelError:  modelErr,
	}
}

// ListCollections returns all indexed collections with counts, ordered by name.
func (s *AppService) ListCollections() ([]Collection, error) {
	rows, err := db.DB.Query(`
		SELECT c.id, c.name, c.collection_type, c.description, c.created_at,
			(SELECT COUNT(*) FROM sources s WHERE s.collection_id = c.id),
			(SELECT COUNT(*) FROM documents d WHERE d.collection_id = c.id)
		FROM collections c
		ORDER BY c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Collection
	for rows.Next() {
		var c Collection
		var desc, created sql.NullString
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &desc, &created, &c.Sources, &c.Chunks); err != nil {
			return nil, err
		}
		if desc.Valid {
			c.Description = desc.String
		}
		if created.Valid {
			c.Created = created.String
		}
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
