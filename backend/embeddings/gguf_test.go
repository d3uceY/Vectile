package embeddings

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

// ggufBuilder writes a minimal GGUF header (magic, version, no tensors, the
// given metadata KVs) so ReadMetadata can be tested without a real model.
type ggufBuilder struct {
	b bytes.Buffer
	n uint64
}

func (g *ggufBuilder) str(key, val string) {
	ggufStr(&g.b, key)
	_ = binary.Write(&g.b, binary.LittleEndian, uint32(8)) // GGUF_TYPE_STRING
	ggufStr(&g.b, val)
	g.n++
}

func (g *ggufBuilder) u32(key string, val uint32) {
	ggufStr(&g.b, key)
	_ = binary.Write(&g.b, binary.LittleEndian, uint32(4)) // GGUF_TYPE_UINT32
	_ = binary.Write(&g.b, binary.LittleEndian, val)
	g.n++
}

func (g *ggufBuilder) bytes() []byte {
	var hdr bytes.Buffer
	_ = binary.Write(&hdr, binary.LittleEndian, uint32(ggufMagic))
	_ = binary.Write(&hdr, binary.LittleEndian, uint32(3)) // version
	_ = binary.Write(&hdr, binary.LittleEndian, uint64(0)) // tensor count
	_ = binary.Write(&hdr, binary.LittleEndian, g.n)       // metadata KV count
	hdr.Write(g.b.Bytes())
	return hdr.Bytes()
}

func ggufStr(b *bytes.Buffer, s string) {
	_ = binary.Write(b, binary.LittleEndian, uint64(len(s)))
	b.WriteString(s)
}

func writeGGUF(t *testing.T, build func(*ggufBuilder)) string {
	t.Helper()
	g := &ggufBuilder{}
	build(g)
	path := filepath.Join(t.TempDir(), "model.gguf")
	if err := os.WriteFile(path, g.bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestReadMetadata(t *testing.T) {
	path := writeGGUF(t, func(g *ggufBuilder) {
		g.str("general.architecture", "bert")
		g.u32("bert.embedding_length", 1024)
		g.u32("bert.context_length", 8192)
	})
	dims, ctx, err := ReadMetadata(path)
	if err != nil {
		t.Fatal(err)
	}
	if dims != 1024 || ctx != 8192 {
		t.Fatalf("ReadMetadata = %d/%d, want 1024/8192", dims, ctx)
	}
}

func TestReadMetadataMissingKeys(t *testing.T) {
	path := writeGGUF(t, func(g *ggufBuilder) {
		g.str("general.name", "some model")
		g.u32("general.file_type", 2)
	})
	dims, ctx, err := ReadMetadata(path)
	if err != nil {
		t.Fatal(err)
	}
	if dims != 0 || ctx != 0 {
		t.Fatalf("ReadMetadata = %d/%d, want 0/0 for absent keys", dims, ctx)
	}
}

func TestReadMetadataBadMagic(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.gguf")
	if err := os.WriteFile(path, []byte("not a gguf file"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := ReadMetadata(path); err == nil {
		t.Fatal("expected error for non-GGUF file")
	}
}
