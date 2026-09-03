package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"vectile/backend/appdata"
)

func TestCatalogContainsRecommended(t *testing.T) {
	cat := ModelCatalog()
	if len(cat) == 0 {
		t.Fatal("catalog is empty")
	}
	if _, ok := CatalogByKey("bge-small-en-v1.5-q8_0"); !ok {
		t.Fatal("missing recommended model key")
	}
}

// DownloadModel rejects a model that is already installed.
func TestDownloadRejectsInstalled(t *testing.T) {
	appdata.Dir = t.TempDir()
	dir := appdata.ModelsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	cat, _ := CatalogByKey("bge-small-en-v1.5-q8_0")
	if err := os.WriteFile(filepath.Join(dir, cat.File), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := &ModelService{core: &Core{}}
	if _, err := s.DownloadModel("bge-small-en-v1.5-q8_0"); err == nil {
		t.Fatal("expected an error when the model is already installed")
	}
}

// A downloaded file that isn't a valid embedding GGUF must fail and remove the
// partial file (the embedding-dimension check replaces the old checksum gate).
func TestDownloadRejectsInvalidGGUF(t *testing.T) {
	appdata.Dir = t.TempDir()
	dir := appdata.ModelsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("this is not a GGUF file"))
	}))
	defer srv.Close()

	cat, _ := CatalogByKey("bge-small-en-v1.5-q8_0")
	cat.URL = srv.URL // serve our fixture instead of the real upstream
	s := &ModelService{core: &Core{}}
	s.runDownload(context.Background(), cat)

	st := s.GetDownloadState()
	if st.Status != "failed" {
		t.Fatalf("expected failed, got %q (%s)", st.Status, st.Error)
	}
	if _, err := os.Stat(filepath.Join(dir, cat.File+".part")); !os.IsNotExist(err) {
		t.Fatal("partial file should be removed after a failed download")
	}
}
