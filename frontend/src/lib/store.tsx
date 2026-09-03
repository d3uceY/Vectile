import { createContext, createSignal, onCleanup, onMount, useContext, type JSX } from "solid-js";
import { Events } from "@wailsio/runtime";
import * as api from "./api";
import { baseName } from "./format";
import type {
  AppConfig,
  CatalogModel,
  Collection,
  Document,
  IndexCancelled,
  IndexComplete,
  IndexFileProgress,
  IndexProgress,
  IndexState,
  MCPStatus,
  ModelDownloadError,
  ModelDownloadProgress,
  ModelDownloadState,
  ModelInfo,
  ModelState,
  SearchFilters,
  SearchResult,
  Source,
  Status,
  ViewId,
} from "./types";

export interface Toast {
  id: number;
  message: string;
  tone: "neutral" | "success" | "danger";
}

const DEFAULT_TOP_K = 12;

const defaultFilters = (topK = DEFAULT_TOP_K): SearchFilters => ({
  collection: "",
  sourceType: "",
  path: "",
  sender: "",
  author: "",
  dateFrom: "",
  dateTo: "",
  topK,
});

export function createAppStore() {
  const [view, setViewRaw] = createSignal<ViewId>("search");

  // Settings leave-guard: a navigation away from Settings that's being held
  // because the settings draft has unsaved edits. SettingsView shows a dialog
  // ("Save settings / Keep editing / Leave without saving") before the switch
  // actually happens.
  const [pendingLeave, setPendingLeave] = createSignal<ViewId | null>(null);

  // The Settings form draft + dirty flag. The draft lives HERE (not in the
  // Settings view) so unsaved edits survive switching views; leaving keeps
  // them in memory, and the leave guard above refuses to navigate away while
  // dirty until the user saves, keeps editing, or discards.
  const [settingsDraft, setSettingsDraftRaw] = createSignal<AppConfig | null>(null);
  const [settingsDirty, setSettingsDirty] = createSignal(false);

  // Every mutation of the draft through the public setter is a user edit, so
  // it flips the dirty flag. Non-user writes (initializing from the loaded
  // config, discarding) use replaceSettingsDraft instead.
  const setSettingsDraft = (
    v: AppConfig | null | ((d: AppConfig | null) => AppConfig | null),
  ) => {
    setSettingsDraftRaw((d) =>
      typeof v === "function" ? (v as (x: AppConfig | null) => AppConfig | null)(d) : v,
    );
    setSettingsDirty(true);
  };
  const replaceSettingsDraft = (v: AppConfig | null) => setSettingsDraftRaw(v);

  // Logical CPUs available: the ceiling for the model's CPU-threads slider.
  const [cpuCount, setCpuCount] = createSignal(0);

  // Navigate to a view. While the settings draft is dirty, leaving Settings is
  // held until the user resolves it through the leave dialog.
  const setView = (next: ViewId) => {
    if (next === view()) return;
    if (view() === "settings" && settingsDirty()) {
      setPendingLeave(next);
      return;
    }
    setViewRaw(next);
  };
  const cancelLeave = () => setPendingLeave(null);
  // Resolve a held navigation. discard=true drops the unsaved draft first; the
  // default keeps it in memory (dirty stays true, so revisiting Settings shows
  // the edits still there).
  const confirmLeave = (opts?: { discard?: boolean }) => {
    const next = pendingLeave();
    if (opts?.discard) {
      replaceSettingsDraft(null);
      setSettingsDirty(false);
    }
    setPendingLeave(null);
    if (next) setViewRaw(next);
  };

  const [modelState, setModelState] = createSignal<ModelState>("idle");
  const [modelName, setModelName] = createSignal("bge-m3");

  const [status, setStatus] = createSignal<Status | null>(null);
  const [collections, setCollections] = createSignal<Collection[]>([]);
  const [config, setConfig] = createSignal<AppConfig | null>(null);
  const [models, setModels] = createSignal<ModelInfo[]>([]);

  // Model download (in-app): catalog + live download state + onboarding dialog.
  const [recommended, setRecommended] = createSignal<CatalogModel[]>([]);
  const [downloadState, setDownloadState] = createSignal<ModelDownloadState | null>(null);
  const [modelDialogOpen, setModelDialogOpen] = createSignal(false);
  // Dismissing lasts only this session, so a fresh launch with no model asks again.
  const [modelDialogDismissed, setModelDialogDismissed] = createSignal(false);

  // Live state of the in-app MCP server (running / port / URL). Seeded on
  // mount and updated by the mcp:status event the backend emits on start/stop.
  const [mcpStatus, setMCPStatus] = createSignal<MCPStatus | null>(null);
  const refreshMCP = async () => {
    try {
      setMCPStatus(await api.getMCPStatus());
    } catch {
      /* backend not ready yet */
    }
  };

  // Library / Browse data (loaded on demand)
  const [sources, setSources] = createSignal<Source[]>([]);
  const [documents, setDocuments] = createSignal<Document[]>([]);

  // Search state
  const [query, setQuery] = createSignal("");
  const [filters, setFilters] = createSignal<SearchFilters>(defaultFilters());
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [searchState, setSearchState] = createSignal<"idle" | "searching" | "done">("idle");

  // Result score display: rank (#1) is the honest default; percent is opt-in
  // and persisted so the choice survives restarts.
  const [scoreDisplay, setScoreDisplayRaw] = createSignal<"rank" | "percent">(
    localStorage.getItem("vectile.score-display") === "percent" ? "percent" : "rank",
  );
  const setScoreDisplay = (v: "rank" | "percent") => {
    setScoreDisplayRaw(v);
    localStorage.setItem("vectile.score-display", v);
  };

  // Library / Browse state
  const [expandedCollection, setExpandedCollection] = createSignal<string | null>(null);
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);

  // Indexing state (progress/complete events from the backend)
  const [indexing, setIndexing] = createSignal(false);
  const [indexProgress, setIndexProgress] = createSignal<IndexProgress | null>(null);
  const [indexLast, setIndexLast] = createSignal<IndexComplete | null>(null);
  // Per-collection progress, keyed by collection name; drives the inline
  // loader on the dir currently being indexed.
  const [indexByCollection, setIndexByCollection] = createSignal<Record<string, IndexFileProgress>>({});
  // True while an "Index all" run is in flight, so per-collection complete
  // events don't each reload the library; the backend's single
  // indexing:all-done event reloads it once at the end instead.
  const [indexAllActive, setIndexAllActive] = createSignal(false);

  // Toasts
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  let toastSeq = 0;

  const pushToast = (message: string, tone: Toast["tone"] = "neutral") => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };
  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  // Guard against out-of-order responses: embeddings are slow, so a query
  // the user typed earlier can still be resolving after they've moved on.
  // Each search claims the next sequence number; only the newest one may
  // write results or flip the state back to "done".
  let searchSeq = 0;

  const runSearch = async (q: string, f: SearchFilters = filters()) => {
    const seq = ++searchSeq;
    setQuery(q);
    setFilters(f);
    if (!q.trim()) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("searching");
    try {
      const res = await api.search(q, f);
      if (seq !== searchSeq) return; // superseded by a newer query; drop it
      setResults(res);
    } catch (err) {
      if (seq !== searchSeq) return;
      setResults([]);
      pushToast(`Search failed: ${err}`, "danger");
    } finally {
      // Only the newest search turns the spinner off, so a slow older
      // embedding can't clear the "searching" state for the query on screen.
      if (seq === searchSeq) setSearchState("done");
    }
  };

  const clearSearch = () => {
    searchSeq++; // invalidate any in-flight search
    setQuery("");
    setFilters(defaultFilters(config()?.search_defaults.top_k));
    setResults([]);
    setSearchState("idle");
  };

  // Global Cmd/Ctrl+K: SearchView registers its input; AppShell can jump to it.
  let searchInput: HTMLInputElement | null = null;
  const registerSearchInput = (el: HTMLInputElement | null) => {
    searchInput = el;
  };
  const focusSearch = () => {
    setView("search");
    setTimeout(() => searchInput?.focus(), 0);
  };

  // Pull status + collections from the backend.
  const refresh = async () => {
    try {
      const st = await api.getStatus();
      setStatus(st);
      setModelState(st.modelState);
      setModelName(st.modelName);
      setCollections(await api.listCollections());
    } catch {
      /* backend not ready yet */
    }
  };

  const loadConfig = async () => {
    try {
      const c = await api.getConfig();
      setConfig(c);
      // Adopt the configured default result count (Settings → search_defaults)
      // for the advanced "Results" dropdown, unless the user already picked one.
      setFilters((f) =>
        f.topK === DEFAULT_TOP_K ? { ...f, topK: c.search_defaults.top_k } : f,
      );
    } catch {
      /* ignore */
    }
  };

  // Load a collection's sources into the shared sources list.
  const loadSources = async (collectionId: number) => {
    try {
      const list = await api.listSources(collectionId);
      setSources((prev) => [
        ...prev.filter((s) => s.collectionId !== collectionId),
        ...list,
      ]);
    } catch {
      /* ignore */
    }
  };

  // Load all sources + documents so Browse can render the whole tree.
  const loadLibrary = async () => {
    try {
      const cols = await api.listCollections();
      const srcs: Source[] = [];
      const docs: Document[] = [];
      for (const c of cols) {
        const cs = await api.listSources(c.id);
        srcs.push(...cs);
        for (const s of cs) {
          try {
            docs.push(...(await api.listDocuments(s.collectionId, s.id)));
          } catch {
            /* ignore */
          }
        }
      }
      setSources(srcs);
      setDocuments(docs);
    } catch {
      /* ignore */
    }
  };

  // Persist the settings draft to the backend and mark it clean. Called from
  // the Settings view's own Save button and from the leave dialog. Then
  // reconcile the MCP server with the draft: stop it if it is running but
  // should not be (or the port changed), then start it if enabled. The
  // backend's StartServer/StopServer are idempotent, so saving unrelated
  // settings is harmless.
  const saveSettings = async () => {
    const d = settingsDraft();
    if (!d) return;
    await api.setConfig(d);
    setConfig(d);
    setSettingsDirty(false);
    await refresh();
    const st = mcpStatus();
    const wantRunning = d.mcp.enabled;
    const portChanged = Boolean(st?.running && st.port !== d.mcp.port);
    if (st?.running && (!wantRunning || portChanged)) {
      await api.stopMCP();
    }
    if (wantRunning) {
      try {
        const url = await api.startMCP(d.mcp.port);
        if (!st?.running) pushToast(`MCP server on ${url}`, "success");
        void refreshMCP();
      } catch (err) {
        pushToast(`MCP server failed to start: ${err}`, "danger");
      }
    } else {
      void refreshMCP();
    }
    pushToast("Settings saved", "success");
  };

  // Logical CPU count for the model's thread slider (0 until the backend
  // answers; the UI falls back to a safe default meanwhile).
  const loadCPUCount = async () => {
    try {
      const n = await api.getCPUCount();
      setCpuCount(typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
    } catch {
      /* backend not ready yet */
    }
  };

  // Model library: refresh the installed-models list from the backend.
  const loadModels = async () => {
    try {
      // Always hand the signal a fresh array so a reused/mutated list from the
      // backend still triggers reactivity (a same-reference set is a no-op).
      setModels([...(await api.listModels())]);
    } catch {
      /* backend not ready yet */
    }
  };

  // Switch the active model. When the backend says switching would change the
  // embedding dimension (needsRebuild) it does NOT apply it yet; the caller
  // shows a confirm dialog, then calls setActiveModel(path, true).
  const setActiveModel = async (path: string, force = false) => {
    const res = await api.setActiveModel(path, force);
    if (!res.needsRebuild) {
      await refresh();
      void loadModels();
      pushToast(`Active model: ${res.model.name}`, "success");
    }
    return { needsRebuild: res.needsRebuild, name: res.model.name };
  };

  const deleteModel = async (path: string, name: string): Promise<boolean> => {
    try {
      await api.deleteModel(path);
      pushToast(`Removed ${name}`, "success");
      void loadModels();
      return true;
    } catch (err) {
      pushToast(`Delete failed: ${err}`, "danger");
      return false;
    }
  };

  const updateModelSettings = async (
    id: number,
    contextWindow: number,
    batchSize: number,
    threads: number,
  ) => {
    try {
      await api.updateModelSettings(id, contextWindow, batchSize, threads);
      pushToast("Model settings saved", "success");
      void loadModels();
    } catch (err) {
      pushToast(`Settings failed: ${err}`, "danger");
    }
  };

  const loadRecommended = async () => {
    try {
      setRecommended(await api.listRecommendedModels());
    } catch {
      /* backend not ready yet */
    }
  };

  const downloadModelByKey = async (key: string) => {
    try {
      const started = await api.downloadModel(key);
      if (!started) pushToast("A download is already running", "neutral");
    } catch (err) {
      pushToast(`Download failed: ${err}`, "danger");
    }
  };

  const cancelDownload = async () => {
    try {
      await api.cancelModelDownload();
    } catch {
      /* ignore */
    }
  };

  const importModelFile = async () => {
    const p = await api.pickModelFile();
    if (!p) return;
    try {
      await api.importModel(p);
      await loadModels();
      await refresh();
      setModelDialogOpen(false);
      pushToast("Model imported", "success");
    } catch (err) {
      pushToast(`Import failed: ${err}`, "danger");
    }
  };

  const closeModelDialog = () => {
    setModelDialogOpen(false);
    setModelDialogDismissed(true);
  };

  // Uninstall a catalog model by its filename (matches the installed row).
  const uninstallCatalogFile = async (file: string) => {
    const m = models().find((x) => baseName(x.path) === file);
    if (m) await deleteModel(m.path, m.name);
  };

  // Seed the download bar after a reload so a mid-download state isn't lost.
  const hydrateDownload = async () => {
    try {
      const st = await api.getDownloadState();
      if (!st || typeof st !== "object" || typeof (st as { active?: unknown }).active !== "boolean") return;
      setDownloadState(st as ModelDownloadState);
    } catch {
      /* backend not ready yet */
    }
  };


  // Index view actions. The backend reports whether a run actually started;
  // "indexing" is only set on a confirmed start so a rejected request (another
  // run in progress) never leaves the buttons permanently disabled; the mute
  // bug where pressing Index did nothing.

  // Seeded loader state shown the instant a run is confirmed, before the
  // backend has touched its first file (model warm-up + the file walk can take
  // a moment). The first real indexing:file event overwrites it with counts.
  const preparingProgress = (name: string): IndexFileProgress => ({
    collection: name,
    file: "Preparing…",
    indexed: 0,
    total: 0,
  });

  // The collection names an "Index all" run will touch: enabled + has source
  // paths, mirroring backend services.configuredCollections.
  const configuredNames = (): string[] => {
    const cfg = config();
    if (!cfg) return [];
    const disabled = new Set(cfg.disabled_collections);
    const names: string[] = [];
    if (cfg.obsidian_vaults.length && !disabled.has("obsidian")) names.push("obsidian");
    if (cfg.calibre_libraries.length && !disabled.has("calibre")) names.push("calibre");
    for (const [name, paths] of Object.entries(cfg.repositories)) {
      if (paths.length && !disabled.has(name)) names.push(name);
    }
    for (const [name, paths] of Object.entries(cfg.projects)) {
      if (paths.length && !disabled.has(name)) names.push(name);
    }
    return names;
  };

  const startIndex = async (name: string, force = false) => {
    setIndexLast(null);
    setIndexProgress(null);
    setIndexAllActive(false); // a single-collection run reloads on its own complete
    setIndexByCollection((m) => {
      const n = { ...m };
      delete n[name];
      return n;
    });
    const started = await api.indexCollection(name, force);
    if (!started) {
      pushToast("Another index is already running", "neutral");
      return;
    }
    // Loader shows immediately, before the first indexing:file event.
    setIndexByCollection((m) => ({ ...m, [name]: preparingProgress(name) }));
    setIndexing(true);
  };

  const startIndexAll = async (force = false) => {
    setIndexLast(null);
    setIndexProgress(null);
    const started = await api.indexAll(force);
    if (!started) {
      pushToast("Another index is already running", "neutral");
      return;
    }
    // Seed every collection the run will touch so each row's loader is visible
    // up front; real per-file events take over as they arrive.
    setIndexByCollection((m) => {
      const n = { ...m };
      for (const name of configuredNames()) n[name] = preparingProgress(name);
      return n;
    });
    setIndexAllActive(true);
    setIndexing(true);
  };

  const cancelIndex = async () => {
    if (await api.cancelIndexing()) pushToast("Cancelling index…", "neutral");
  };

  const runPrune = async (name: string) => {
    try {
      await api.prune(name);
      pushToast(`Pruned ${name || "all"}`, "success");
      await refresh();
    } catch (err) {
      pushToast(`Prune failed: ${err}`, "danger");
    }
  };

  // Add a source path to the config (used by the setup tour and Settings) and
  // reload the frontend config so new paths show up immediately.
  const addSource = async (kind: string, name: string, path: string): Promise<boolean> => {
    try {
      await api.addSourcePath(kind, name, path);
      await loadConfig();
      return true;
    } catch (err) {
      pushToast(`Could not add ${name}: ${err}`, "danger");
      return false;
    }
  };

  const toggleCollection = async (name: string, enabled: boolean) => {
    try {
      await api.toggleCollectionEnabled(name, enabled);
      setCollections((cs) => cs.map((c) => (c.name === name ? { ...c, enabled } : c)));
      await loadConfig();
    } catch (err) {
      pushToast(`Toggle failed: ${err}`, "danger");
    }
  };

  // Delete one indexed source (documents + embeddings + FTS). The path stays
  // configured, so it can be re-indexed. Returns true on success.
  const deleteSource = async (sourceId: number, label: string): Promise<boolean> => {
    try {
      const removed = await api.deleteSource(sourceId);
      pushToast(
        `Removed ${label} from the index · ${removed} chunk${removed === 1 ? "" : "s"}`,
        "success",
      );
      void refresh();
      void loadLibrary();
      return true;
    } catch (err) {
      pushToast(`Delete failed: ${err}`, "danger");
      return false;
    }
  };

  // Delete a set of chunks (documents) in one pass. The sources and
  // collections stay; re-indexing restores the deleted chunks. Returns true
  // on success.
  const deleteDocuments = async (docIDs: number[], label: string): Promise<boolean> => {
    try {
      const removed = await api.deleteDocuments(docIDs);
      pushToast(
        `Removed ${label} · ${removed} chunk${removed === 1 ? "" : "s"} deleted`,
        "success",
      );
      setSelectedDoc(null);
      void refresh();
      void loadLibrary();
      return true;
    } catch (err) {
      pushToast(`Delete failed: ${err}`, "danger");
      return false;
    }
  };

  // Delete a whole collection: indexed data (sources, documents, embeddings,
  // FTS) plus its config entry, so it won't resurrect on the next index pass.
  // Returns true on success.
  const deleteCollection = async (name: string, label: string): Promise<boolean> => {
    try {
      const removed = await api.deleteCollection(name);
      pushToast(
        `Deleted ${label} · ${removed.toLocaleString()} chunk${removed === 1 ? "" : "s"} removed`,
        "success",
      );
      setExpandedCollection(null);
      setSelectedDoc(null);
      await loadConfig();
      void refresh();
      void loadLibrary();
      return true;
    } catch (err) {
      pushToast(`Delete failed: ${err}`, "danger");
      return false;
    }
  };

  // Indexing events emitted by the backend IndexService.
  const offProgress = Events.On("indexing:progress", (ev) =>
    setIndexProgress(ev.data as IndexProgress),
  );
  const offFile = Events.On("indexing:file", (ev) => {
    const e = ev.data as IndexFileProgress;
    setIndexByCollection((m) => ({ ...m, [e.collection]: e }));
  });
  const offComplete = Events.On("indexing:complete", (ev) => {
    const e = ev.data as IndexComplete;
    setIndexByCollection((m) => {
      const n = { ...m };
      delete n[e.collection];
      return n;
    });
    setIndexProgress(null);
    setIndexLast(e);
    // A single-collection run ends on its complete event. An IndexAll keeps
    // indexing=true until indexing:all-done, so the UI doesn't flip to "done"
    // between collections (which made it look like nothing was running).
    if (!indexAllActive()) {
      setIndexing(false);
      // Reload for single-collection runs; an IndexAll reloads once on
      // indexing:all-done instead (one loadLibrary per collection was heavy).
      void loadLibrary();
    }
    void refresh();
    if (e.errors > 0) pushToast(`${e.collection}: ${e.errors} error(s)`, "danger");
    else pushToast(`Indexed ${e.collection} · ${e.indexed} new`, "success");
  });
  const offAllDone = Events.On("indexing:all-done", () => {
    setIndexAllActive(false);
    setIndexing(false); // the whole all-run is done; clear the in-progress state
    void loadLibrary(); // browse picks up freshly indexed files once, not per collection
  });
  const offCancelled = Events.On("indexing:cancelled", (ev) => {
    const e = ev.data as IndexCancelled;
    setIndexByCollection((m) => {
      const n = { ...m };
      delete n[e.collection];
      return n;
    });
    setIndexProgress(null);
    setIndexing(false);
    setIndexAllActive(false); // a cancelled all-run is done too
    void refresh();
    pushToast(`Indexing ${e.collection} cancelled · ${e.indexed} indexed`, "neutral");
  });
  const offPruned = Events.On("indexing:pruned", (ev) => {
    const n = ev.data as number;
    if (n > 0) pushToast(`Pruned ${n} stale sources`, "neutral");
  });
  // Active model changed (switch, or settings applied to the running model).
  const offModelChanged = Events.On("model:changed", () => {
    void refresh();
    void loadModels();
  });
  // MCP server started/stopped (from Settings save or a model-switch path);
  // keeps the Settings status plate live without polling.
  const offMCP = Events.On("mcp:status", (ev) => {
    setMCPStatus(ev.data as MCPStatus);
  });
  const offDlProgress = Events.On("model:download-progress", (ev) => {
    const d = ev.data as ModelDownloadProgress;
    setDownloadState({
      active: true, key: d.key, status: "downloading",
      downloaded: d.downloaded, total: d.total, percent: d.percent, speed: d.speed, error: "",
    });
  });
  const offDlComplete = Events.On("model:download-complete", (ev) => {
    const m = ev.data as ModelInfo;
    pushToast(`Model ready: ${m?.name ?? "Embedding model"}`, "success");
    void loadModels();
    void refresh();
    setDownloadState(null);
    setModelDialogOpen(false);
  });
  const offDlFailed = Events.On("model:download-failed", (ev) => {
    const e = ev.data as ModelDownloadError;
    pushToast(`Download failed: ${e.message}`, "danger");
    setDownloadState(null);
  });
  const offDlCancelled = Events.On("model:download-cancelled", () => {
    pushToast("Download cancelled", "neutral");
    setDownloadState(null);
  });

  // A freshly loaded frontend has no idea the backend is mid-index (events
  // emitted before it subscribed are lost), so on mount we ask the backend for
  // the current run and rebuild the indexing state. Live events still drive
  // every update after that; this only seeds the initial state on (re)load.
  const hydrateIndexing = async () => {
    try {
      const st = await api.getIndexingState();
      // Older backends / the dev stub may not answer this yet; only apply a
      // well-formed snapshot so we never clobber real event state with junk.
      if (!st || typeof st !== "object" || typeof (st as { active?: unknown }).active !== "boolean") {
        return;
      }
      const s = st as IndexState;
      if (!s.active) return; // nothing running; keep the default idle state
      setIndexing(true);
      setIndexAllActive(Boolean(s.all));
      const map: Record<string, IndexFileProgress> = {};
      for (const [name, p] of Object.entries(s.collections ?? {})) map[name] = p;
      setIndexByCollection(map);
    } catch {
      /* backend not ready yet */
    }
  };

  onMount(() => {
    void refresh();
    void loadConfig();
    void loadRecommended();
    void hydrateIndexing();
    void hydrateDownload();
    void loadCPUCount();
    void refreshMCP();
    // Ask about a model only when there really is none installed.
    void (async () => {
      await loadModels();
      if (models().length === 0 && !modelDialogDismissed()) setModelDialogOpen(true);
    })();
  });
  onCleanup(() => {
    offProgress();
    offFile();
    offComplete();
    offCancelled();
    offAllDone();
    offPruned();
    offModelChanged();
    offMCP();
    offDlProgress();
    offDlComplete();
    offDlFailed();
    offDlCancelled();
  });

  return {
    view,
    setView,
    modelState,
    modelName,
    status,
    collections,
    config,
    models,
    recommended,
    downloadState,
    modelDialogOpen,
    closeModelDialog,
    downloadModelByKey,
    cancelDownload,
    importModelFile,
    uninstallCatalogFile,
    mcpStatus,
    refreshMCP,
    loadModels,
    setActiveModel,
    deleteModel,
    updateModelSettings,
    settingsDraft,
    settingsDirty,
    setSettingsDraft,
    replaceSettingsDraft,
    saveSettings,
    pendingLeave,
    cancelLeave,
    confirmLeave,
    cpuCount,
    loadConfig,
    sources,
    documents,
    loadSources,
    loadLibrary,
    query,
    setQuery,
    filters,
    setFilters,
    results,
    scoreDisplay,
    setScoreDisplay,
    searchState,
    runSearch,
    clearSearch,
    registerSearchInput,
    focusSearch,
    expandedCollection,
    setExpandedCollection,
    selectedDoc,
    setSelectedDoc,
    indexing,
    indexProgress,
    indexByCollection,
    indexLast,
    startIndex,
    startIndexAll,
    cancelIndex,
    runPrune,
    addSource,
    toggleCollection,
    deleteSource,
    deleteDocuments,
    deleteCollection,
    toasts,
    pushToast,
    dismissToast,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;

const AppStoreCtx = createContext<AppStore>();

export function AppStoreProvider(props: { children: JSX.Element }) {
  const store = createAppStore();
  return (
    <AppStoreCtx.Provider value={store}>{props.children}</AppStoreCtx.Provider>
  );
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreCtx);
  if (!ctx) throw new Error("useAppStore must be used inside <AppStoreProvider>");
  return ctx;
}
