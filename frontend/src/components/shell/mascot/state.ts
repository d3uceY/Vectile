import { createMemo, type Accessor } from "solid-js";
import { useAppStore } from "../../../lib/store";
import type { ActiveMascotState } from "./types";

/** Resolve which interaction the store is currently reporting.
    Priority: a background index run is the longest-lived and loudest signal, so
    it wins; search/no-results only count while the Search view is on screen.
    Returns `null` when nothing is active. */
export function useMascotState(): Accessor<ActiveMascotState | null> {
  const store = useAppStore();

  return createMemo<ActiveMascotState | null>(() => {
    if (store.indexing() || store.indexProgress() !== null) return "indexing";
    if (store.view() === "search") {
      if (store.searchState() === "searching") return "searching";
      if (store.searchState() === "done" && store.results().length === 0) return "nothing";
    }
    return null;
  });
}
