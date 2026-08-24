import { createContext, createSignal, useContext, type JSX } from "solid-js";
import type {
  Collection,
  Document,
  ModelState,
  SearchFilters,
  SearchResult,
  ViewId,
} from "./types";
import { mockCollections, mockSearch } from "./mock";

export interface Toast {
  id: number;
  message: string;
  tone: "neutral" | "success" | "danger";
}

const defaultFilters = (): SearchFilters => ({
  collection: "",
  sourceType: "",
  path: "",
  sender: "",
  author: "",
  dateFrom: "",
  dateTo: "",
  topK: 12,
});

export function createAppStore() {
  const [view, setView] = createSignal<ViewId>("search");

  // In-process model engine (llama.go) — not a remote service.
  const [modelState, setModelState] = createSignal<ModelState>("loaded");
  const [modelName] = createSignal("bge-m3 · 1024d");

  const [collections] = createSignal<Collection[]>(mockCollections);

  // Search state
  const [query, setQuery] = createSignal("");
  const [filters, setFilters] = createSignal<SearchFilters>(defaultFilters());
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [searchState, setSearchState] = createSignal<"idle" | "searching" | "done">("idle");

  // Library / Browse state
  const [expandedCollection, setExpandedCollection] = createSignal<string | null>(null);
  const [selectedDoc, setSelectedDoc] = createSignal<Document | null>(null);

  // Toasts
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  let toastSeq = 0;

  const runSearch = (q: string, f: SearchFilters = filters()) => {
    setQuery(q);
    setFilters(f);
    if (!q.trim()) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("searching");
    // Simulated latency so the searching state is real before the real
    // bindings land. Still well under a beat.
    setTimeout(() => {
      setResults(mockSearch(q, f));
      setSearchState("done");
    }, 120);
  };

  const clearSearch = () => {
    setQuery("");
    setFilters(defaultFilters());
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
    // Let Solid mount the Search view before focusing its input.
    setTimeout(() => searchInput?.focus(), 0);
  };

  const pushToast = (message: string, tone: Toast["tone"] = "neutral") => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return {
    view,
    setView,
    modelState,
    setModelState,
    modelName,
    collections,
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
