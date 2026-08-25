package embeddings

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

// ggufMagic is the "GGUF" marker at the start of every GGUF file.
const ggufMagic = 0x46554747

// ReadMetadata extracts the embedding dimension and context length from a
// GGUF file's header without loading the model, so the models list and the
// dimension-change check never have to load a ~1GB model just to read two
// numbers. Returns 0 for a dimension/context that isn't present in the file
// (some models omit these keys); the embedder confirms the real dimension
// when the model is loaded.
func ReadMetadata(path string) (dims, context int, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()
	r := bufio.NewReader(f)

	var magic uint32
	if err := binary.Read(r, binary.LittleEndian, &magic); err != nil {
		return 0, 0, err
	}
	if magic != ggufMagic {
		return 0, 0, fmt.Errorf("not a GGUF file (bad magic)")
	}
	var version uint32
	if err := binary.Read(r, binary.LittleEndian, &version); err != nil {
		return 0, 0, err
	}
	var tensorCount uint64
	if err := binary.Read(r, binary.LittleEndian, &tensorCount); err != nil {
		return 0, 0, err
	}
	var kvCount uint64
	if err := binary.Read(r, binary.LittleEndian, &kvCount); err != nil {
		return 0, 0, err
	}
	_ = tensorCount

	var arch string
	for i := uint64(0); i < kvCount; i++ {
		key, err := readString(r)
		if err != nil {
			return 0, 0, err
		}
		t, err := readU32(r)
		if err != nil {
			return 0, 0, err
		}
		u64, str, err := readValue(r, t)
		if err != nil {
			return 0, 0, err
		}
		switch {
		case key == "general.architecture":
			arch = str
		case arch != "" && key == arch+".embedding_length":
			dims = int(u64)
		case arch != "" && key == arch+".context_length":
			context = int(u64)
		}
	}
	return dims, context, nil
}

func readString(r *bufio.Reader) (string, error) {
	var n uint64
	if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
		return "", err
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return "", err
	}
	return string(buf), nil
}

func readU32(r *bufio.Reader) (uint32, error) {
	var v uint32
	err := binary.Read(r, binary.LittleEndian, &v)
	return v, err
}

func readU64(r *bufio.Reader) (uint64, error) {
	var v uint64
	err := binary.Read(r, binary.LittleEndian, &v)
	return v, err
}

// readValue decodes a GGUF metadata value of the given type. Only the string
// and integer types the reader cares about are decoded; everything else is
// skipped (arrays are walked so the stream stays aligned).
func readValue(r *bufio.Reader, t uint32) (u64 uint64, s string, err error) {
	switch t {
	case 4: // uint32
		v, e := readU32(r)
		return uint64(v), "", e
	case 10: // uint64
		v, e := readU64(r)
		return v, "", e
	case 5: // int32
		var v int32
		e := binary.Read(r, binary.LittleEndian, &v)
		return uint64(v), "", e
	case 11: // int64
		var v int64
		e := binary.Read(r, binary.LittleEndian, &v)
		return uint64(v), "", e
	case 8: // string
		s, err = readString(r)
		return 0, s, err
	case 9: // array
		et, e := readU32(r)
		if e != nil {
			return 0, "", e
		}
		cnt, e := readU64(r)
		if e != nil {
			return 0, "", e
		}
		for i := uint64(0); i < cnt; i++ {
			if _, _, e := readValue(r, et); e != nil {
				return 0, "", e
			}
		}
		return 0, "", nil
	default:
		var skip int
		switch t {
		case 0, 1, 7: // uint8, int8, bool
			skip = 1
		case 2, 3: // uint16, int16
			skip = 2
		case 6: // float32
			skip = 4
		case 12: // float64
			skip = 8
		default:
			return 0, "", fmt.Errorf("unknown GGUF value type %d", t)
		}
		_, err = r.Discard(skip)
		return 0, "", err
	}
}
