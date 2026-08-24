package chunker

import (
	"strings"
	"testing"
)

func TestSplitIntoWindows(t *testing.T) {
	// Short text stays whole.
	short := "just a few words here"
	if got := SplitIntoWindows(short, 20, 5); len(got) != 1 {
		t.Fatalf("short text should be one window, got %d", len(got))
	}

	// Long text splits; first window hits the budget.
	text := strings.Repeat("word ", 100)
	chunks := SplitIntoWindows(text, 20, 5)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple windows, got %d", len(chunks))
	}
	if got := WordCount(chunks[0]); got != 20 {
		t.Fatalf("first window has %d words, want 20", got)
	}

	// Overlap: the tail of window N carries into the head of window N+1.
	a, b := strings.Fields(chunks[0]), strings.Fields(chunks[1])
	if a[len(a)-5] != b[0] {
		t.Fatal("expected 5-word overlap between consecutive windows")
	}
}

func TestChunkMarkdown(t *testing.T) {
	src := "# Overview\n\nSome intro text.\n\n## Details\n\nMore content here.\n"
	chunks := ChunkMarkdown(src, "note.md", 500, 50)
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}
	foundHeading := false
	for _, c := range chunks {
		if _, ok := c.Metadata["heading_path"]; ok {
			foundHeading = true
		}
		if !strings.HasPrefix(c.Text, "[") && strings.Contains(c.Text, "Overview") {
			t.Log("preamble chunk has no heading prefix (expected)")
		}
	}
	if !foundHeading {
		t.Fatal("expected a chunk carrying heading_path metadata")
	}
}

func TestChunkPlain(t *testing.T) {
	empty := ChunkPlain("   ", "x", 500, 50)
	if len(empty) != 1 || empty[0].Text != "" {
		t.Fatalf("blank text should yield one empty chunk, got %v", empty)
	}

	text := strings.Repeat("sentence of words ", 60)
	chunks := ChunkPlain(text, "x", 50, 10)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	if chunks[0].Title != "x" {
		t.Fatalf("title not preserved: %q", chunks[0].Title)
	}
}
