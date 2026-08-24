package embeddings

import "testing"

func TestSerializeRoundtrip(t *testing.T) {
	vec := []float32{0.1, -0.2, 3.5, 0, 1, 0.0001}
	buf := SerializeFloat32(vec)
	got := DeserializeFloat32(buf)
	if len(got) != len(vec) {
		t.Fatalf("len = %d, want %d", len(got), len(vec))
	}
	for i := range vec {
		if got[i] != vec[i] {
			t.Fatalf("mismatch at %d: %v != %v", i, got[i], vec[i])
		}
	}
}
