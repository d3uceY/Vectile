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
	conn.SetMaxOpenConns(1)
	conn.SetMaxIdleConns(1)
	if err := conn.Ping(); err != nil {
		return err
	}
	if _, err := conn.Exec(`PRAGMA foreign_keys = ON`); err != nil {
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
