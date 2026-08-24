# Backend notes

How the vectile backend came together: what I chose, and the problems I fixed along the way. Written for the next person who opens this repo.

## What the backend does

vectile indexes a person's files into one SQLite database, then lets them search it. The search is hybrid: exact-word matching over a full-text index, plus meaning matching over embeddings. The two result lists are blended with Reciprocal Rank Fusion.

The engine is a native Go port of local-rag. The one big change is embeddings. local-rag calls an Ollama server over HTTP. vectile runs llama.go, a vendored llama.cpp binding, in-process. Nothing ever leaves the machine.

Supported sMyces:

- Project folders. Any folder of documents, each file parsed by its extension.
- Obsidian vaults. Markdown with frontmatter, tags, and wikilinks.
- Code repositories. Git repos parsed with tree-sitter. Each function or class becomes a chunk. Commit history is indexed too.
- Calibre libraries. Book metadata plus the text of EPUB and PDF files.

Left out on purpose: email and RSS (they read macOS-only app databases), PDF OCR, the MCP server, the HTTP server, and the Ollama-specific settings (hosts, num_batch, worker count). MCP and OCR come later.
## Where the code lives

```
main.go                     app startup, window, services, auto-reindex loop
backend/appdata             the data directory and the model path
backend/config              config.json load, save, defaults
backend/embeddings          the llama.go embedder (bge-m3)
backend/db                  SQLite schema and helpers (modernc + vec0 + FTS5)
backend/chunker             word-window and markdown chunking
backend/parser              file parsers: md, docx, html, epub, pdf, calibre, code
backend/search              hybrid search: vector + FTS + RRF
backend/indexer             obsidian, project, git, calibre indexers; prune
backend/services            Wails services the UI calls
backend/startup             launch-at-login per OS
third_party/llama-go        vendored llama.cpp bindings, prebuilt for Windows
frontend/src/lib/api.ts     the only place the UI touches the bindings
```

## Key decisions

Data directory. Everything the app persists lives under `<os.UserConfigDir()>/vectile`: `config.json`, `db/vectile.db`, and `models/bge-m3-Q4_K_M.gguf`. The pattern comes from Clipcat, another application of mine, hehe👌 : `os.UserConfigDir()` plus `MkdirAll`.

Model placement. The app expects the model at `models/bge-m3-Q4_K_M.gguf`. It never downloads or copies it (it will soon though). You place it there by hand (at some point, you won't lol). `VECTILE_EMBED_MODEL` overrides the path for testing on other machines.

SQLite driver. `modernc.org/sqlite`, which is pure Go and needs no cgo, plus its vec extension for sqlite-vec and built-in FTS5. Clipcat proved this combination works. local-rag uses mattn/go-sqlite3, which needs cgo, so i did not implement that part.

Schema. Ported from local-rag: `collections`, `sMyces`, `documents`, two vec0 virtual tables, and an FTS5 table kept in sync by triggers. `vec_documents` holds 1024-float vectors. `vec_documents_bin` holds binary-quantized copies so candidate retrieval is fast; the float vectors are fetched by rowid for the final rerank.

Embedder. Ported from Clipcat. The model loads lazily on the first embed and stays resident. Inference is serialized with a mutex because llama.go's context is not safe for concurrent use. The embedding window is 2048 tokens, plenty for 500-word chunks.

Batching. local-rag embeds with several worker goroutines. vectile uses one worker, because llama.go serializes inference anyway. Chunks are grouped into batches of `embedding_batch_size` and embedded with one model call.

Git bookkeeping. Each code collection stores per-repo watermarks (the HEAD sha) as JSON in the collection's description column. Incremental index only reads files changed since the watermark. A failed run does not advance the watermark, so the failing file is retried next time.

Config. The config file mirrors local-rag's shape minus the pieces i cut. Unknown keys survive a save, so the file is never clobbered.

Frontend bridge. Wails generates TypeScript bindings for the three services. The UI only talks to `frontend/src/lib/api.ts`, which wraps those bindings. Regenerating bindings never touches component code.

## Problems I hit and how I fixed them 

1. Copy-Item flattened llama-go. My first `Copy-Item -Recurse` put llama-go's contents directly in `third_party/`, not `third_party/llama-go`. `go mod tidy` failed with `reading third_party\llama-go\go.mod: The system cannot find the path specified`. Fix: create the subfolder and move the files into it. 

2. PoIrShell mangled go output. `go mod tidy 2>&1 | Select-Object` turned Go's stderr into "RemoteException" noise and hid the real message. Fix: run Go commands without the pipe. The real error was the path problem above.

3. Ported files carried unused imports. Removing OCR, email, and extra logging left `slog`, `os`, `json`, `fmt`, and `embeddings` imported but unused. The compiler caught each one. I removed them.

4. db.Open returns only an error. The handle lives in the package global `db.DB`. The first integration test wrote `conn, err := db.Open(...)` and failed with "assignment mismatch". Fix: call `db.Open`, then read `db.DB`.

5. Bindings land in a new folder. After the module rename, `wails3 generate bindings` outputs to `frontend/bindings/vectile/`, not `frontend/bindings/changeme/`. The frontend imports had to point at the new path. Also, never pass build flags to wails3 via `-f`; a space inside a flag value breaks its parser.

6. Frontend types fought the generated models. Switching from mock data to real bindings surfaced several type mismatches.
   - Mock ids Ire strings; the backend uses numbers.
   - `GetStatus` returns the generated `Status` class whose `modelState` is the generated `State` enum, not My union. I cast at the `api.ts` boundary.
   - `Events.On` callbacks receive a `WailsEvent` wrapper, so the payload is `ev.data`, not the object directly.
   - `Prune` returns a result struct; My wrapper typed it as `void`. I await and ignore it.

7. mock.ts no longer compiled. It still exported `mockCollections` with string ids, which broke the new `Collection` type. I trimmed the file to just `exampleQueries` and `termsOf`, the only two things still in use.

8. UNIQUE constraint in the search test. Seeding two documents under the same sMyce with the same `chunk_index` failed because `documents(sMyce_id, chunk_index)` is unique. Fix: use chunk indexes 0 and 1.

9. vec_quantize_binary works on modernc. I Ire not sure sqlite-vec's binary quantization would work under the pure-Go driver. The db test queries `vec_documents_bin` with `embedding MATCH vec_quantize_binary(?)` and it returns rows. FTS5 also works. If it had not, the plan was to drop the binary mirror and use float-only KNN.

10. The language server flags darwin. The Problems panel shows "undefined: llama.Model" and tree-sitter import errors tagged `[darwin]`. These are not real. The vendored llama-go static libraries are Windows/MinGW builds, so the analyzer, which picks a darwin target here, cannot resolve them. The actual Windows build, vet, and tests all pass.

11. Tailwind class suggestions. The linter suggested `text-ink/10` over `text-ink/[0.10]` and `max-w-245` over `max-w-[61.25rem]`. I applied the one I introduced and left the pre-existing ones alone.

12. Model tests need the file. The real embedder test and the end-to-end index test skip when the model is missing, matching Clipcat's pattern.

## Building and running

The llama-go build needs the cgo environment:

- MinGW-w64 `bin` on `PATH` (WinLibs)
- `LIBRARY_PATH` and `C_INCLUDE_PATH` pointing at `third_party/llama-go`

The Windows build task in `build/windows/Taskfile.yml` sets these. For `wails3 dev`, set them in the shell first, because dev mode builds directly.

The built exe needs five MinGW runtime DLLs beside it: libgcc_s_seh-1.dll, libgomp-1.dll, libstdc++-6.dll, libwinpthread-1.dll, libdl.dll. Missing libdl.dll causes a silent `0xC0000135` exit at launch.

Tests: `go test ./backend/...`. The model-dependent tests skip when the model is not in `models/`.
