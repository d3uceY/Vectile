package indexer

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"vectile/backend/chunker"
	"vectile/backend/config"
	"vectile/backend/db"
	"vectile/backend/embeddings"
)

// indexItem is one thing to index — a file, a book, a commit — reduced to
// what storage needs: an identity, its chunks, and the metadata to record.
type indexItem struct {
	SourcePath string
	SourceType string
	Title      string
	Chunks     []chunker.Chunk
	Metadata   map[string]any
	FileHash   string
	Mtime      string
}

// itemBatch is a group of items whose chunks are embedded in one request.
type itemBatch struct {
	items   []*indexItem
	texts   []string    // all chunk texts, item then chunk order
	vecs    [][]float32 // filled by the embedding step
	dropped int         // items removed by the individual-retry fallback
}

// itemFunc returns the item at index i, or nil to skip it (unchanged, or
// nothing extractable). Items are built lazily so parsing only happens for
// items that will actually be embedded.
type itemFunc func(i int) *indexItem

// indexItemsBatched chunks, embeds, and stores a run of items. Embedding is
// sequential (llama.go serializes inference anyway) and every DB write happens
// on this goroutine, since SQLite takes no concurrent writers.
func indexItemsBatched(
	ctx context.Context,
	conn *sql.DB,
	cfg *config.Config,
	collectionID int64,
	label string,
	total int,
	itemAt itemFunc,
	embedder Embedder,
	result *IndexResult,
	progress ProgressCallback,
	preCleared bool,
) {
	if total == 0 {
		return
	}

	b := &itemBatcher{cfg: cfg, total: total, itemAt: itemAt}
	defer func() { result.Skipped += b.skipped }()
	indexed := 0

	for {
		// Check cancellation between batches: SQLite writes aren't preemptable
		// mid-statement, so batch boundaries are the coarsest safe abort point.
		if ctx != nil && ctx.Err() != nil {
			return
		}
		batch := b.nextBatch()
		if batch == nil {
			return
		}

		vecs, err := embedder.EmbedBatch(batch.texts)
		if err != nil {
			embedItemsIndividually(batch, embedder)
			vecs = batch.vecs
		} else {
			batch.vecs = vecs
		}

		// Progress fires once per successfully indexed file so the frontend can
		// increment a per-collection count from a scoped event.
		for _, t := range writeItemBatch(conn, collectionID, batch, result, preCleared) {
			indexed++
			if progress != nil {
				progress(indexed, total, t)
			}
		}
	}
}

// embedItemsIndividually retries a failed batch one item at a time, so a
// single unembeddable item costs only itself.
func embedItemsIndividually(b *itemBatch, embedder Embedder) {
	slog.Warn("embedding batch failed, retrying items individually",
		"items", len(b.items))

	kept := make([]*indexItem, 0, len(b.items))
	texts := make([]string, 0, len(b.texts))
	vecs := make([][]float32, 0, len(b.texts))
	var failed int

	for _, item := range b.items {
		itemTexts := make([]string, len(item.Chunks))
		for i, c := range item.Chunks {
			itemTexts[i] = c.Text
		}

		itemVecs, err := embedder.EmbedBatch(itemTexts)
		if err != nil || len(itemVecs) != len(itemTexts) {
			failed++
			if failed <= 5 {
				slog.Warn("skipping item that cannot be embedded",
					"type", item.SourceType, "path", item.SourcePath,
					"chunks", len(item.Chunks), "err", err)
			}
			continue
		}
		kept = append(kept, item)
		texts = append(texts, itemTexts...)
		vecs = append(vecs, itemVecs...)
	}

	b.items, b.texts, b.vecs, b.dropped = kept, texts, vecs, failed
}

// itemBatcher walks items in order, grouping them into batches of roughly
// embedding_batch_size chunks. An item's chunks are never split across batches.
type itemBatcher struct {
	cfg     *config.Config
	total   int
	next    int
	itemAt  itemFunc
	skipped int // items the itemFunc declined, or that had no usable text
}

// nextBatch returns the next batch, or nil once the items are exhausted.
func (b *itemBatcher) nextBatch() *itemBatch {
	target := b.cfg.EmbeddingBatchSize
	if target < 1 {
		target = 1
	}

	batch := &itemBatch{}
	for b.next < b.total {
		item := b.itemAt(b.next)
		b.next++

		if item == nil || !hasContent(item.Chunks) {
			b.skipped++
			continue
		}

		batch.items = append(batch.items, item)
		for _, c := range item.Chunks {
			batch.texts = append(batch.texts, c.Text)
		}
		if len(batch.texts) >= target {
			return batch
		}
	}
	if len(batch.items) > 0 {
		return batch
	}
	return nil
}

// hasContent reports whether any chunk carries non-blank text.
func hasContent(chunks []chunker.Chunk) bool {
	for _, c := range chunks {
		if strings.TrimSpace(c.Text) != "" {
			return true
		}
	}
	return false
}

// writeItemBatch stores an embedded batch, attributing failures per item so
// one bad item does not sink the rest.
// writeItemBatch stores an embedded batch, attributing failures per item so
// one bad item does not sink the rest. It returns the titles of the items
// that were successfully stored, so the caller can emit per-file progress.
func writeItemBatch(conn *sql.DB, collectionID int64, b *itemBatch, result *IndexResult, preCleared bool) []string {
	if b.dropped > 0 {
		result.Errors += b.dropped
		result.ErrorMessages = append(result.ErrorMessages,
			fmt.Sprintf("%d item(s) could not be embedded and were skipped", b.dropped))
	}

	// Offsets into b.vecs are only meaningful if one vector came back per text.
	if len(b.vecs) != len(b.texts) {
		msg := fmt.Sprintf("embedding count mismatch: got %d vectors for %d chunks", len(b.vecs), len(b.texts))
		slog.Error(msg)
		result.Errors += len(b.items)
		result.ErrorMessages = append(result.ErrorMessages, msg)
		return nil
	}

	if !preCleared {
		purgeSourceDocuments(conn, collectionID, b.items)
	}

	var indexedTitles []string
	offset := 0
	for _, item := range b.items {
		vecs := b.vecs[offset : offset+len(item.Chunks)]
		offset += len(item.Chunks)

		if err := storeItem(conn, collectionID, item, vecs); err != nil {
			result.Errors++
			if result.Errors <= 10 {
				msg := fmt.Sprintf("error indexing %s %s: %v", item.SourceType, item.SourcePath, err)
				slog.Warn(msg)
				result.ErrorMessages = append(result.ErrorMessages, msg)
			}
			continue
		}
		result.Indexed++
		indexedTitles = append(indexedTitles, item.Title)
	}
	return indexedTitles
}

// sqlParamLimit bounds how many bind parameters go into one statement.
const sqlParamLimit = 500

// purgeSourceDocuments removes the existing documents and embeddings for every
// item in a batch, in as few statements as possible. Batched because the vec0
// tables have no index on document_id, so per-item deletes would each scan the
// whole vector table.
func purgeSourceDocuments(conn *sql.DB, collectionID int64, items []*indexItem) {
	if len(items) == 0 {
		return
	}

	var docIDs []any
	for start := 0; start < len(items); start += sqlParamLimit {
		end := start + sqlParamLimit
		if end > len(items) {
			end = len(items)
		}
		args := make([]any, 0, len(items[start:end])+1)
		args = append(args, collectionID)
		for _, item := range items[start:end] {
			args = append(args, item.SourcePath)
		}
		placeholders := strings.TrimSuffix(strings.Repeat("?,", end-start), ",")

		rows, err := conn.Query(`
			SELECT d.id FROM documents d
			JOIN sources s ON d.source_id = s.id
			WHERE s.collection_id = ? AND s.source_path IN (`+placeholders+`)`, args...)
		if err != nil {
			slog.Warn("cannot list documents to purge", "err", err)
			return
		}
		for rows.Next() {
			var id int64
			if rows.Scan(&id) == nil {
				docIDs = append(docIDs, id)
			}
		}
		rows.Close()
	}

	if len(docIDs) == 0 {
		return
	}

	for start := 0; start < len(docIDs); start += sqlParamLimit {
		end := start + sqlParamLimit
		if end > len(docIDs) {
			end = len(docIDs)
		}
		chunk := docIDs[start:end]
		if err := db.DeleteEmbeddings(conn, chunk); err != nil {
			slog.Warn("cannot delete embeddings", "err", err)
		}
		placeholders := strings.TrimSuffix(strings.Repeat("?,", len(chunk)), ",")
		if _, err := conn.Exec("DELETE FROM documents WHERE id IN ("+placeholders+")", chunk...); err != nil {
			slog.Warn("cannot delete documents", "err", err)
		}
	}
}

// storeItem writes one item's chunks and their embeddings. vecs is parallel
// to item.Chunks. purged=true skips the per-source cleanup because the batch
// was already purged.
func storeItem(conn *sql.DB, collectionID int64, item *indexItem, vecs [][]float32) error {
	sourceID, err := upsertSourceRow(conn, collectionID, item.SourcePath, item.SourceType,
		item.FileHash, item.Mtime, true)
	if err != nil {
		return err
	}

	for i, c := range item.Chunks {
		metaJSON, err := chunkMetadata(item, c)
		if err != nil {
			return err
		}
		title := c.Title
		if item.Title != "" {
			title = item.Title
		}

		docRes, err := conn.Exec(
			"INSERT INTO documents (source_id, collection_id, chunk_index, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?)",
			sourceID, collectionID, c.ChunkIndex, title, c.Text, metaJSON,
		)
		if err != nil {
			return fmt.Errorf("insert document: %w", err)
		}
		docID, _ := docRes.LastInsertId()
		if err := db.InsertEmbedding(conn, docID, embeddings.SerializeFloat32(vecs[i])); err != nil {
			return fmt.Errorf("insert embedding: %w", err)
		}
	}
	return nil
}

// chunkMetadata merges item-wide metadata with the chunk's own; chunk keys win.
func chunkMetadata(item *indexItem, c chunker.Chunk) (string, error) {
	if len(item.Metadata) == 0 && len(c.Metadata) == 0 {
		return "", nil
	}
	merged := make(map[string]any, len(item.Metadata)+len(c.Metadata))
	for k, v := range item.Metadata {
		merged[k] = v
	}
	for k, v := range c.Metadata {
		merged[k] = v
	}
	b, err := json.Marshal(merged)
	if err != nil {
		return "", fmt.Errorf("marshal metadata: %w", err)
	}
	return string(b), nil
}
