package db

import (
	"database/sql"
	"path/filepath"
	"testing"

	"vectile/backend/embeddings"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	conn, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	conn.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func TestInitSchemaIdempotent(t *testing.T) {
	conn := testDB(t)
	if err := InitSchema(conn, EmbeddingDim); err != nil {
		t.Fatal(err)
	}
	// Calling again on startup must be a no-op.
	if err := InitSchema(conn, EmbeddingDim); err != nil {
		t.Fatal(err)
	}

	var version string
	if err := conn.QueryRow("SELECT value FROM meta WHERE key = 'schema_version'").Scan(&version); err != nil {
		t.Fatalf("schema version not recorded: %v", err)
	}
	if version != "1" {
		t.Fatalf("schema version = %q", version)
	}
}

// TestVectorAndFTSRoundtrip verifies the vec0 tables (float + binary mirror)
// and the FTS5 triggers all work end to end on modernc.
func TestVectorAndFTSRoundtrip(t *testing.T) {
	conn := testDB(t)
	if err := InitSchema(conn, EmbeddingDim); err != nil {
		t.Fatal(err)
	}

	collID, err := GetOrCreateCollection(conn, "test", "project", nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	srcRes, err := conn.Exec(
		"INSERT INTO sources (collection_id, source_type, source_path) VALUES (?,?,?)",
		collID, "markdown", "/tmp/note.md",
	)
	if err != nil {
		t.Fatal(err)
	}
	sourceID, _ := srcRes.LastInsertId()

	docRes, err := conn.Exec(
		"INSERT INTO documents (source_id, collection_id, chunk_index, title, content) VALUES (?,?,?,?,?)",
		sourceID, collID, 0, "Note", "the quick brown fox jumps over the lazy dog",
	)
	if err != nil {
		t.Fatal(err)
	}
	docID, _ := docRes.LastInsertId()

	// The AFTER INSERT trigger keeps FTS5 in sync.
	var fts int
	if err := conn.QueryRow(
		"SELECT COUNT(*) FROM documents_fts WHERE documents_fts MATCH '\"quick\"'",
	).Scan(&fts); err != nil {
		t.Fatal(err)
	}
	if fts != 1 {
		t.Fatalf("expected 1 FTS hit, got %d", fts)
	}

	// Insert a full-dim embedding; both tables get a row, rowids aligned.
	vec := make([]float32, EmbeddingDim)
	vec[0], vec[1] = 1, 0.5
	if err := InsertEmbedding(conn, docID, embeddings.SerializeFloat32(vec)); err != nil {
		t.Fatal(err)
	}

	var fRows, bRows int
	if err := conn.QueryRow("SELECT COUNT(*) FROM vec_documents WHERE document_id = ?", docID).Scan(&fRows); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRow("SELECT COUNT(*) FROM vec_documents_bin WHERE document_id = ?", docID).Scan(&bRows); err != nil {
		t.Fatal(err)
	}
	if fRows != 1 || bRows != 1 {
		t.Fatalf("expected 1 float + 1 binary row, got %d + %d", fRows, bRows)
	}

	// Binary-quantized KNN must return the row (vec_quantize_binary support).
	rows, err := conn.Query(
		"SELECT rowid FROM vec_documents_bin WHERE embedding MATCH vec_quantize_binary(?) ORDER BY distance LIMIT 5",
		embeddings.SerializeFloat32(vec),
	)
	if err != nil {
		t.Fatalf("vec_quantize_binary unsupported: %v", err)
	}
	defer rows.Close()
	if !rows.Next() {
		t.Fatal("binary KNN returned no rows")
	}
}

func TestGetOrCreateCollectionConflict(t *testing.T) {
	conn := testDB(t)
	if err := InitSchema(conn, EmbeddingDim); err != nil {
		t.Fatal(err)
	}
	if _, err := GetOrCreateCollection(conn, "x", "project", nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := GetOrCreateCollection(conn, "x", "code", nil, nil); err == nil {
		t.Fatal("expected ErrCollectionTypeConflict")
	}
}
