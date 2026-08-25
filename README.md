# vectile: your private library

<p align="center">
  <img src="docs/vectile-banner.svg" alt="vectile: your private library" width="100%">
</p>

vectile is a search engine for your own stuff. Everything you've written, read, and kept (your Obsidian vault, project folders, Calibre library, and code repos) is scattered across your machine. vectile brings it all together into one searchable library.

Search it by exact words, or just by what you mean. It's fast, keyboard-first, and runs entirely offline. Nothing ever leaves your computer.

Inspired by Sebastian Hutter's [local-rag](https://github.com/sebastianhutter/local-rag). No Ollama, no cloud, no API keys.

## What it looks like

Screenshots show sample data.

<p align="center">
  <img src="docs/screenshots/search.png" alt="Searching for 'kubernetes rollout' across notes, email, RSS, and books" width="100%">
</p>

<table>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="Library view: collections with sources and chunk counts" width="100%"></td>
    <td><img src="docs/screenshots/browse.png" alt="Browse view: a file tree of collections, files, and chunks with a preview pane" width="100%"></td>
    <td><img src="docs/screenshots/settings.png" alt="Settings view: model, chunking, and search options" width="100%"></td>
  </tr>
</table>

## What it does

- **Search by meaning, not just words.** "How do we ship changes safely" can find the note about blue-green deploys that never uses those words.
- **Everything in one place.** Add your Obsidian vault, project folders, Calibre library, and code repos. They all get indexed into one searchable library.
- **Fast and keyboard-first.** Jump to search from anywhere with ⌘K / Ctrl K. Type, and results show up right away.
- **Browse your files.** Walk through your library as a file tree, with a preview of each chunk.
- **Understands code.** Functions and classes are indexed on their own, and so is your commit history.
- **Stays current on its own.** Index one collection or everything at once. Files you delete get pruned automatically, so results don't go stale.
- **Private by design.** Everything runs on your machine. No server, no cloud, no network calls.

## Built with

Wails v3 · Go · SolidJS + TypeScript + Vite · Tailwind CSS v4 · SQLite with sqlite-vec and FTS5 · llama.go (llama.cpp) · Fraunces, Plus Jakarta Sans, IBM Plex Mono