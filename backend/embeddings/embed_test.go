package embeddings

import (
	"math"
	"os"
	"path/filepath"
	"testing"
)

// testModelPath resolves the embedding model the same way the app does
// (VECTILE_EMBED_MODEL override, else the app-data models dir).
func testModelPath() string {
	if p := os.Getenv("VECTILE_EMBED_MODEL"); p != "" {
		return p
	}
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(cfgDir, "vectile", "models", "bge-m3-Q4_K_M.gguf")
}

func cosine(a, b []float32) float64 {
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

// TestEmbedRealModel exercises the full pipeline (llama-go -> GGUF ->
// []float32) with the real bge-m3 model: it loads, produces 1024-dim vectors,
// and ranks a similar sentence pair above an unrelated one. Skips when the
// model file isn't present so the suite still passes elsewhere.
func TestEmbedRealModel(t *testing.T) {
	path := testModelPath()
	if _, err := os.Stat(path); err != nil {
		t.Skipf("model not present: %v", err)
	}

	e := NewEmbedder(path)
	defer e.Close()

	vec, err := e.Embed("the quick brown fox jumps over the lazy dog")
	if err != nil {
		t.Fatal(err)
	}
	if len(vec) != 1024 {
		t.Fatalf("expected 1024 dims, got %d", len(vec))
	}
	if e.State() != StateLoaded {
		t.Fatalf("expected StateLoaded, got %s", e.State())
	}

	a, err := e.Embed("a cat sits on the mat")
	if err != nil {
		t.Fatal(err)
	}
	b, err := e.Embed("a kitten rests on the rug")
	if err != nil {
		t.Fatal(err)
	}
	c, err := e.Embed("the stock market opened higher today")
	if err != nil {
		t.Fatal(err)
	}

	simAB, simAC := cosine(a, b), cosine(a, c)
	if simAB <= simAC {
		t.Fatalf("expected similar pair to rank closer: ab=%f ac=%f", simAB, simAC)
	}
}
