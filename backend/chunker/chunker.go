// Package chunker provides text chunking strategies for different content
// types. All chunkers use word-based windows sized by the config.
package chunker

import (
	"regexp"
	"sort"
	"strings"
)

// Chunk represents a piece of text ready for embedding, with metadata.
type Chunk struct {
	Text       string
	Title      string
	Metadata   map[string]any
	ChunkIndex int
}

// WordCount estimates token count by splitting on whitespace.
func WordCount(text string) int {
	return len(strings.Fields(text))
}

// SplitIntoWindows splits text into overlapping word-based windows.
func SplitIntoWindows(text string, chunkSize, overlap int) []string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	if len(words) <= chunkSize {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < len(words) {
		end := start + chunkSize
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[start:end], " "))
		if end >= len(words) {
			break
		}
		start = end - overlap
	}
	return chunks
}

var headingPattern = regexp.MustCompile(`(?m)^(#{1,6})\s+(.+)$`)

// ChunkMarkdown splits markdown text on headings, preserving the heading path
// as a context prefix. Sections are chunked word-wise if they exceed the size.
func ChunkMarkdown(text, title string, chunkSize, overlap int) []Chunk {
	if strings.TrimSpace(text) == "" {
		return []Chunk{{Text: "", Title: title, Metadata: map[string]any{}, ChunkIndex: 0}}
	}

	type section struct {
		headingPath string
		content     string
	}

	matches := headingPattern.FindAllStringSubmatchIndex(text, -1)

	var sections []section
	if len(matches) == 0 {
		sections = append(sections, section{headingPath: "", content: strings.TrimSpace(text)})
	} else {
		preamble := strings.TrimSpace(text[:matches[0][0]])
		if preamble != "" {
			sections = append(sections, section{headingPath: "", content: preamble})
		}

		currentHeadings := make(map[int]string)
		for i, match := range matches {
			level := match[3] - match[2]
			headingText := strings.TrimSpace(text[match[4]:match[5]])

			contentStart := match[1]
			contentEnd := len(text)
			if i+1 < len(matches) {
				contentEnd = matches[i+1][0]
			}
			content := strings.TrimSpace(text[contentStart:contentEnd])

			currentHeadings[level] = headingText
			for k := range currentHeadings {
				if k > level {
					delete(currentHeadings, k)
				}
			}

			var levels []int
			for k := range currentHeadings {
				levels = append(levels, k)
			}
			sort.Ints(levels)
			var parts []string
			for _, l := range levels {
				parts = append(parts, currentHeadings[l])
			}
			headingPath := strings.Join(parts, " > ")

			if content != "" {
				sections = append(sections, section{headingPath: headingPath, content: content})
			}
		}
	}

	var chunks []Chunk
	chunkIdx := 0
	for _, sec := range sections {
		prefix := ""
		if sec.headingPath != "" {
			prefix = "[" + sec.headingPath + "] "
		}
		prefixed := prefix + sec.content

		if WordCount(prefixed) <= chunkSize {
			meta := map[string]any{}
			if sec.headingPath != "" {
				meta["heading_path"] = sec.headingPath
			}
			chunks = append(chunks, Chunk{Text: prefixed, Title: title, Metadata: meta, ChunkIndex: chunkIdx})
			chunkIdx++
		} else {
			prefixWords := WordCount(prefix)
			windows := SplitIntoWindows(sec.content, chunkSize-prefixWords, overlap)
			for _, w := range windows {
				meta := map[string]any{}
				if sec.headingPath != "" {
					meta["heading_path"] = sec.headingPath
				}
				chunks = append(chunks, Chunk{Text: prefix + w, Title: title, Metadata: meta, ChunkIndex: chunkIdx})
				chunkIdx++
			}
		}
	}

	if len(chunks) == 0 {
		chunks = append(chunks, Chunk{Text: strings.TrimSpace(text), Title: title, Metadata: map[string]any{}, ChunkIndex: 0})
	}
	return chunks
}

// ChunkPlain chunks plain text using fixed-size word windows with overlap.
func ChunkPlain(text, title string, chunkSize, overlap int) []Chunk {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return []Chunk{{Text: "", Title: title, Metadata: map[string]any{}, ChunkIndex: 0}}
	}

	windows := SplitIntoWindows(trimmed, chunkSize, overlap)
	chunks := make([]Chunk, len(windows))
	for i, w := range windows {
		chunks[i] = Chunk{Text: w, Title: title, Metadata: map[string]any{}, ChunkIndex: i}
	}
	return chunks
}
