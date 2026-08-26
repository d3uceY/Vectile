package indexer

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"vectile/backend/chunker"
	"vectile/backend/config"
	"vectile/backend/db"
)

// stubEmbedder is a controllable Embedder for tests. It records how many
// texts each EmbedBatch call carries (so tests can assert the slice cap), can
// block on its first call to hold a slice "mid-embed", and can fail a chosen
// chunk to exercise the individual-retry fallback.
type stubEmbedder struct {
	mu       sync.Mutex
	calls    int
	maxBatch int

	started chan struct{}          // closed when the first EmbedBatch call begins
	release chan struct{}          // if non-nil, the first call blocks until closed
	fail    func(text string) bool // if non-nil, return an error when true
}

func (e *stubEmbedder) EmbedBatch(texts []string) ([][]float32, error) {
	e.mu.Lock()
	e.calls++
	if len(texts) > e.maxBatch {
		e.maxBatch = len(texts)
	}
	first := e.calls == 1
	e.mu.Unlock()

	if first && e.started != nil {
		close(e.started)
	}
	if first && e.release != nil {
		<-e.release
	}

	out := make([][]float32, len(texts))
	for i, t := range texts {
		if e.fail != nil && e.fail(t) {
			return nil, fmt.Errorf("stub: cannot embed %q", t)
		}
		v := make([]float32, db.EmbeddingDim)
		for j := range v {
			v[j] = float32((i + j) % 7)
		}
		out[i] = v
	}
	return out, nil
}

// makeItems builds n items, each with chunksPer chunks of distinct text, so
// the total chunk-text count is n*chunksPer.
func makeItems(n, chunksPer int) []*indexItem {
	items := make([]*indexItem, 0, n)
	for f := 0; f < n; f++ {
		it := &indexItem{
			SourcePath: filepath.Join("C:\\fake", fmt.Sprintf("f%d.md", f)),
			SourceType: "markdown",
			Title:      fmt.Sprintf("f%d", f),
		}
		for c := 0; c < chunksPer; c++ {
			it.Chunks = append(it.Chunks, chunker.Chunk{
				Text:       fmt.Sprintf("chunk-%d-%d", f, c),
				Title:      fmt.Sprintf("f%d", f),
				ChunkIndex: c,
			})
		}
		items = append(items, it)
	}
	return items
}

// TestCancelStopsRunAtSliceBoundary is the regression test for coarse
// cancellation: a cancel must land at a slice boundary (≤ embedSliceCap
// chunks) instead of after the whole batch, and nothing may be written once
// cancelled. Without slicing, the whole batch (all 12 texts here) would be a
// single blocking EmbedBatch call and the run would index every item before
// noticing the cancel.
func TestCancelStopsRunAtSliceBoundary(t *testing.T) {
	if err := db.Open(filepath.Join(t.TempDir(), "cancel.db")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	items := makeItems(4, 3)                          // 12 chunk texts total, > embedSliceCap (8)
	cfg := &config.Config{EmbeddingBatchSize: 100000} // everything would be one batch
	emb := &stubEmbedder{started: make(chan struct{}), release: make(chan struct{})}

	ctx, cancel := context.WithCancel(context.Background())
	result := &IndexResult{}
	done := make(chan struct{})
	go func() {
		defer close(done)
		indexItemsBatched(ctx, db.DB, cfg, 1, "test", len(items),
			func(i int) *indexItem { return items[i] },
			emb, result, nil, false)
	}()

	<-emb.started // the first slice is being embedded (held open)
	cancel()      // the user hits Cancel
	close(emb.release)

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("indexer did not stop after cancel")
	}

	if emb.calls != 1 {
		t.Fatalf("expected the run to stop after the first slice (1 EmbedBatch call), got %d", emb.calls)
	}
	if emb.maxBatch > embedSliceCap {
		t.Fatalf("one EmbedBatch call carried %d texts, want <= %d — slices must bound blocking calls", emb.maxBatch, embedSliceCap)
	}
	if result.Indexed != 0 {
		t.Fatalf("expected nothing to be indexed before cancel, got %d", result.Indexed)
	}
}

// TestSliceBatchingIndexesEverything verifies the slice embedding still
// indexes every item correctly while bounding each EmbedBatch call to
// embedSliceCap texts, even when the configured batch size is huge.
func TestSliceBatchingIndexesEverything(t *testing.T) {
	if err := db.Open(filepath.Join(t.TempDir(), "slice.db")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.GetOrCreateCollection(db.DB, "test", "project", nil, nil); err != nil {
		t.Fatal(err)
	}

	items := makeItems(4, 3) // 12 texts -> slices of 8 + 4
	cfg := &config.Config{EmbeddingBatchSize: 100000}
	emb := &stubEmbedder{}

	result := &IndexResult{}
	indexItemsBatched(context.Background(), db.DB, cfg, 1, "test", len(items),
		func(i int) *indexItem { return items[i] },
		emb, result, nil, false)

	if result.Indexed != 4 {
		t.Fatalf("expected 4 items indexed, got %d (errors: %v)", result.Indexed, result.ErrorMessages)
	}
	if result.Errors != 0 {
		t.Fatalf("unexpected errors: %v", result.ErrorMessages)
	}
	if emb.maxBatch > embedSliceCap {
		t.Fatalf("one EmbedBatch call carried %d texts, want <= %d", emb.maxBatch, embedSliceCap)
	}
	if emb.calls != 2 {
		t.Fatalf("expected 2 EmbedBatch calls for 12 texts at cap %d, got %d", embedSliceCap, emb.calls)
	}
}

// TestEmbedFallbackDropsOnlyTheBadItem verifies that when a slice fails as a
// batch, the individual retry keeps good items and drops the unembeddable
// one, counting it as an error.
func TestEmbedFallbackDropsOnlyTheBadItem(t *testing.T) {
	if err := db.Open(filepath.Join(t.TempDir(), "fallback.db")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.GetOrCreateCollection(db.DB, "test", "project", nil, nil); err != nil {
		t.Fatal(err)
	}

	items := makeItems(3, 3) // 9 texts
	bad := "chunk-1-1"       // item 1's second chunk always fails to embed
	emb := &stubEmbedder{fail: func(text string) bool { return text == bad }}
	cfg := &config.Config{EmbeddingBatchSize: 100000}

	result := &IndexResult{}
	indexItemsBatched(context.Background(), db.DB, cfg, 1, "test", len(items),
		func(i int) *indexItem { return items[i] },
		emb, result, nil, false)

	if result.Indexed != 2 {
		t.Fatalf("expected 2 items indexed (bad item dropped), got %d (errors: %v)", result.Indexed, result.ErrorMessages)
	}
	if result.Errors != 1 {
		t.Fatalf("expected 1 error for the dropped item, got %d (%v)", result.Errors, result.ErrorMessages)
	}
}
