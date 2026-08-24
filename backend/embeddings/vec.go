package embeddings

import (
	"encoding/binary"
	"math"
)

// SerializeFloat32 encodes a []float32 into the little-endian BLOB format
// sqlite-vec expects for float vectors.
func SerializeFloat32(v []float32) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

// DeserializeFloat32 decodes a sqlite-vec BLOB back into a []float32.
func DeserializeFloat32(buf []byte) []float32 {
	vec := make([]float32, len(buf)/4)
	for i := range vec {
		vec[i] = math.Float32frombits(binary.LittleEndian.Uint32(buf[i*4:]))
	}
	return vec
}
