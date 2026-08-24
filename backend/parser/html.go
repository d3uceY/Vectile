package parser

import (
	"log/slog"
	"os"
	"strings"

	"golang.org/x/net/html"
)

// ParseHTML extracts plain text from an HTML file.
func ParseHTML(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		slog.Error("failed to read HTML file", "path", path, "err", err)
		return ""
	}
	return HTMLToText(string(data))
}

// HTMLToText converts HTML content to plain text, stripping all tags.
func HTMLToText(content string) string {
	if strings.TrimSpace(content) == "" {
		return ""
	}

	doc, err := html.Parse(strings.NewReader(content))
	if err != nil {
		slog.Warn("failed to parse HTML", "err", err)
		return content // fallback: raw content
	}

	var sb strings.Builder
	extractText(doc, &sb)

	// Deduplicate blank lines.
	var cleaned []string
	for _, line := range strings.Split(sb.String(), "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	return strings.Join(cleaned, "\n")
}

func extractText(n *html.Node, sb *strings.Builder) {
	if n.Type == html.TextNode {
		if text := strings.TrimSpace(n.Data); text != "" {
			sb.WriteString(text)
			sb.WriteString("\n")
		}
	}
	if n.Type == html.ElementNode && isBlockElement(n.Data) && sb.Len() > 0 {
		sb.WriteString("\n")
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && (c.Data == "script" || c.Data == "style") {
			continue
		}
		extractText(c, sb)
	}
}

func isBlockElement(tag string) bool {
	switch tag {
	case "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6",
		"li", "tr", "th", "td", "blockquote", "pre", "section",
		"article", "header", "footer", "nav", "main":
		return true
	}
	return false
}
