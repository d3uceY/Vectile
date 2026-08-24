import { createContext, createSignal, onCleanup, onMount, useContext, type JSX } from "solid-js";
import { Events } from "@wailsio/runtime";
import * as api from "./api";
import type {
  AppConfig,
  Collection,
  Document,
  IndexCancelled,
  IndexComplete,
  IndexFileProgress,
  IndexProgress,
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
  const [view, setView] = createSignal<ViewId>("search");


  const [modelState, setModelState] = createSignal<ModelState>("idle");
  const [modelName, setModelName] = createSignal("bge-m3");

  const [status, setStatus] = createSignal<Status | null>(null);
  const [collections, setCollections] = createSignal<Collection[]>([]);
  const [config, setConfig] = createSignal<AppConfig | null>(null);

  // Library / Browse data (loaded on demand)
  const [sources, setSources] = createSignal<Source[]>([]);
  const [documents, setDocuments] = createSignal<Document[]>([]);

  // Search state
  const [query, setQuery] = createSignal("");
  const [filters, setFilters] = createSignal<SearchFilters>(defaultFilters());
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [searchState, setSearchState] = createSignal<"idle" | "searching" | "done">("idle");

  // Library / Browse state
  const [expandedCollection, setExpandedCollection] = createSignal<string | null>(null);
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);

  // Indexing state (progress/complete events from the backend)
  const [indexing, setIndexing] = createSignal(false);
  const [indexProgress, setIndexProgress] = createSignal<IndexProgress | null>(null);
  const [indexLast, setIndexLast] = createSignal<IndexComplete | null>(null);
  // Per-collection progress, keyed by collection name — drives the inline
  // loader on the dir currently being indexed.
  const [indexByCollection, setIndexByCollection] = createSignal<Record<string, IndexFileProgress>>({});
  // True while an "Index all" run is in flight, so per-collection complete
  // events don't each reload the library — the backend's single
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
      if (seq !== searchSeq) return; // superseded by a newer query — drop it
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

  const saveConfig = async (cfg: AppConfig) => {
    await api.setConfig(cfg);
    setConfig(cfg);
    await refresh();
    pushToast("Settings saved", "success");
  };

  // Index view actions. The backend reports whether a run actually started;
  // "indexing" is only set on a confirmed start so a rejected request (another
  // run in progress) never leaves the buttons permanently disabled — the mute
  // bug where pressing Index did nothing.
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

  const toggleCollection = async (name: string, enabled: boolean) => {
    try {
      await api.toggleCollectionEnabled(name, enabled);
      setCollections((cs) => cs.map((c) => (c.name === name ? { ...c, enabled } : c)));
      await loadConfig();
    } catch (err) {
      pushToast(`Toggle failed: ${err}`, "danger");
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
    setIndexing(false);
    void refresh();
    // Reload for single-collection runs; an IndexAll reloads once on
    // indexing:all-done instead (one loadLibrary per collection was heavy).
    if (!indexAllActive()) void loadLibrary();
    if (e.errors > 0) pushToast(`${e.collection}: ${e.errors} error(s)`, "danger");
    else pushToast(`Indexed ${e.collection} · ${e.indexed} new`, "success");
  });
  const offAllDone = Events.On("indexing:all-done", () => {
    setIndexAllActive(false);
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
    void refresh();
    pushToast(`Indexing ${e.collection} cancelled · ${e.indexed} indexed`, "neutral");
  });
  const offPruned = Events.On("indexing:pruned", (ev) => {
    const n = ev.data as number;
    if (n > 0) pushToast(`Pruned ${n} stale sources`, "neutral");
  });

  onMount(() => {
    void refresh();
    void loadConfig();
  });
  onCleanup(() => {
    offProgress();
    offFile();
    offComplete();
    offCancelled();
    offAllDone();
    offPruned();
  });

  return {
    view,
    setView,
    modelState,
    modelName,
    status,
    collections,
    config,
    saveConfig,
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
    toggleCollection,
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
