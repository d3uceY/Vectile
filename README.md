# vectile — your private library

<p align="center">
  <img src="docs/vectile-banner.svg" alt="vectile — your private library" width="100%">
</p>

vectile is a desktop search engine for everything you've written, read, and kept. Point it at your Obsidian vault, project folders, Calibre library, and code repos. It indexes them into one local database, then finds things with hybrid search: exact-word matches from a full-text index, plus meaning matches from embeddings, blended by rank. Keyboard-first, quick, and nothing ever leaves the machine.

**Inspired by [local-rag](https://github.com/sebastianhutter/local-rag) by Sebastian Hutter.** vectile runs llama.go (llama.cpp bindings) in-process. No Ollama, no cloud, no API keys.

## Screenshots

Screenshots show sample data.

<p align="center">
  <img src="docs/screenshots/search.png" alt="Hybrid search for 'kubernetes rollout' across notes, email, RSS, and books" width="100%">
</p>

<table>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="Library view: collections with sources and chunk counts" width="100%"></td>
    <td><img src="docs/screenshots/browse.png" alt="Browse view: a file tree of collections, files, and chunks with a preview pane" width="100%"></td>
    <td><img src="docs/screenshots/settings.png" alt="Settings view: model, chunking, and search options" width="100%"></td>
  </tr>
</table>

## Features

- **Hybrid search:** vector + full-text fused with Reciprocal Rank Fusion. Filter by collection, source type, path, sender/author, and date.
- **Collections:** Obsidian vaults, project folders, Calibre libraries, and code repos, each with incremental indexing.
- **Code-aware:** functions and classes chunked with tree-sitter; commit history is indexed too.
- **Browse:** a file tree of collections → sources → documents, with a chunk preview pane.
- **Index & prune:** index one collection or all of them. Deleted files are pruned automatically, so results don't go stale.
- **Keyboard-first:** ⌘K / Ctrl K jumps to search from anywhere. Arrow keys navigate the file tree.
- **In-process model:** bge-m3 embeddings run in llama.go inside the app. The status pill shows when the model is loaded.

## How it works

A Go backend and a SolidJS UI live in one native Wails window. Everything runs on your machine: no server, no cloud, no network calls.

Indexing turns files into chunks. Add a source, then press Index. A background worker walks the folder, skips files that haven't changed since the last run, parses each file into text, cuts it into roughly 500-word chunks with a small overlap, and embeds every chunk with the bge-m3 model, turning it into a list of 1024 numbers that capture its meaning. Chunk text, metadata, and vectors go into SQLite: vectors into a vec0 table for similarity search, text into an FTS5 table for exact-word search.

Code repos work differently. Files parse with tree-sitter, so each function or class becomes its own chunk. Git watermarks track which commit was indexed, so the next run reads only files changed since then. Commit history is indexed as its own source type, so you can search diffs.

Search runs two lookups at once. Full-text matches the exact words in your query. Vector search embeds the query and finds stored vectors pointing a similar way, which catches meaning: "how do we roll out changes safely" can match a note about blue-green deploys that never uses those words. The vector path pulls a pool of candidates with a cheap binary-quantized index, then reranks them with exact distances. Reciprocal Rank Fusion blends the two rank lists. Filters narrow by collection, file type, path, sender/author, and date range.

Deleted files don't linger. Prune walks the indexed sources, drops chunks whose file no longer exists, and cleans up orphaned vectors. It runs automatically before "Index all".

The model loads lazily. The status pill sits at idle until the first search or index, which takes a couple of seconds for bge-m3, then stays resident. If the model file is missing or corrupt, the pill shows failed and vector search falls back to full-text, so you still get exact matches.

## How to use

1. **Add a model.** vectile expects a bge-m3 GGUF file in the `models/` folder of the data directory, `<UserConfigDir>/vectile` (Settings shows the path). Drop `bge-m3-Q4_K_M.gguf` there by hand or import one in Settings. The app never downloads it; `VECTILE_EMBED_MODEL` overrides the path. You can keep several models and pick the active one. Switching to a model with a different embedding dimension needs a re-index.
2. **Add sources.** In Settings, add an Obsidian vault, a project folder, a Calibre library, or a code repo.
3. **Index.** In the Index view, index a collection or hit *Index all*. Indexing runs in the background with progress shown.
4. **Search.** Press ⌘K (Ctrl K on Windows/Linux) and type. Click a result to read the full passage.

## Development

```bash
wails3 dev            # run with hot reload
go test ./backend/... # tests (model-dependent tests skip when the model is missing)
wails3 task build     # production build
```

Windows builds need MinGW-w64 (the llama-go CGO build) on PATH, plus the five MinGW runtime DLLs beside the exe. The Windows build task sets these up; see `dev-docs/backend-notes.md` for details. macOS and Linux targets are scaffolded, but the vendored llama-go static libs are Windows-only for now.

## Built with

Wails v3 · Go · SolidJS + TypeScript + Vite · Tailwind CSS v4 · modernc.org/sqlite with sqlite-vec and FTS5 · llama.go (llama.cpp) · Fraunces, Plus Jakarta Sans, IBM Plex Mono