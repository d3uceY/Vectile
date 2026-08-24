// Package db owns the SQLite database: modernc.org/sqlite (CGO-free) with
// the sqlite-vec extension (vec0) and FTS5. Single connection, schema + helpers.
package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
	_ "modernc.org/sqlite/vec" // registers the vec0 module
)

// EmbeddingDim is the length of bge-m3 embedding vectors; it must match the
// declared dimension of the vec0 tables.
const EmbeddingDim = 1024

// DB is the shared application database handle.
var DB *sql.DB

// Open opens the database at path, applies the schema, and stores the handle
// in DB. SQLite is single-writer, so a single connection avoids contention.
func Open(path string) error {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return err
	}
	// WAL + a small connection pool let readers (search/browse/status) proceed
	// while the single writer — the indexer goroutine, serialized by the index
	// mutex — holds a write transaction. With MaxOpenConns(1) a long or stuck
	// write previously blocked every read, freezing the whole app.
	conn.SetMaxOpenConns(4)
	conn.SetMaxIdleConns(4)
	if err := conn.Ping(); err != nil {
		return err
	}
	if _, err := conn.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		return err
	}
	if _, err := conn.Exec(`PRAGMA journal_mode = WAL`); err != nil {
		return err
	}
	if _, err := conn.Exec(`PRAGMA busy_timeout = 5000`); err != nil {
		return err
	}
	DB = conn
	return InitSchema(DB, EmbeddingDim)
}

// Close releases the database.
func Close() error {
	if DB == nil {
		return nil
	}
	err := DB.Close()
	DB = nil
	return err
}
