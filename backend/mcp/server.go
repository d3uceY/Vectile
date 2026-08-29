// Package mcp exposes vectile's local library to MCP (Model Context Protocol)
// clients over a loopback SSE server. Claude Desktop, Claude Code, and any
// other MCP client can search the library and inspect collections. The tools
// are read-only: nothing here triggers indexing or pruning.
package mcp

import (
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"vectile/backend/services"
)

// CreateServer builds the MCP server with the read-only vectile tools.
func CreateServer(core *services.Core) *server.MCPServer {
	s := server.NewMCPServer(
		"vectile",
		"1.0.0",
		server.WithInstructions(
			"Search a private, local knowledge library: Obsidian vaults, books, "+
				"code, and project documents indexed with hybrid vector + full-text "+
				"search. Read-only: queries never modify the library."),
	)

	s.AddTools(
		server.ServerTool{Tool: searchTool, Handler: handleSearch(core)},
		server.ServerTool{Tool: listCollectionsTool, Handler: handleListCollections(core)},
		server.ServerTool{Tool: collectionInfoTool, Handler: handleCollectionInfo(core)},
	)

	return s
}

// Tool definitions

var searchTool = mcp.NewTool("vectile_search",
	mcp.WithDescription(
		"Search the local knowledge library using hybrid vector + full-text "+
			"search with Reciprocal Rank Fusion. Searches across all indexed "+
			"collections by default, combining semantic similarity with keyword "+
			"matching. Read-only."),
	mcp.WithString("query",
		mcp.Required(),
		mcp.Description("Search query text (natural language or keywords)")),
	mcp.WithString("collection",
		mcp.Description("Filter by collection name. Omit to search all.")),
	mcp.WithNumber("top_k",
		mcp.Description("Number of results to return (default: the configured top-k)")),
	mcp.WithString("source_type",
		mcp.Description("Filter by type: 'markdown', 'pdf', 'docx', 'epub', 'html', "+
			"'plaintext', 'code', 'commit', or 'calibre-description'.")),
	mcp.WithString("path",
		mcp.Description("Filter by source path (case-insensitive substring of the "+
			"absolute file path). Use to scope to a subfolder or repo, e.g. "+
			"'backend/services' or 'infrastructure/modules'.")),
	mcp.WithString("date_from",
		mcp.Description("Results after this date (YYYY-MM-DD)")),
	mcp.WithString("date_to",
		mcp.Description("Results before this date (YYYY-MM-DD)")),
	mcp.WithString("sender",
		mcp.Description("Filter by email sender (case-insensitive substring)")),
	mcp.WithString("author",
		mcp.Description("Filter by book author (case-insensitive substring)")),
	mcp.WithObject("metadata_filter",
		mcp.Description("Filter by arbitrary metadata fields. JSON object of "+
			"key-value string pairs. Matches are case-insensitive substring for "+
			"strings, element-wise for arrays.")),
)

var listCollectionsTool = mcp.NewTool("vectile_list_collections",
	mcp.WithDescription(
		"List all collections in the library with source file counts, chunk "+
			"counts, and last-indexed time. Collections of type 'code' represent "+
			"repository collections that may contain multiple git repos."),
)

var collectionInfoTool = mcp.NewTool("vectile_collection_info",
	mcp.WithDescription(
		"Get detailed information about a specific collection: source count, "+
			"chunk count, source type breakdown, last indexed timestamp, and a "+
			"sample of document titles."),
	mcp.WithString("collection",
		mcp.Required(),
		mcp.Description("The collection name. Use vectile_list_collections() to "+
			"discover available names.")),
)
