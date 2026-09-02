import { createMemo, type Accessor } from "solid-js";
import { useAppStore } from "../../../lib/store";
import type { ActiveMascotState } from "./types";

/** Resolve which interaction the store is currently reporting.
    Priority: a background index run is the longest-lived and loudest signal, so
    it wins; search/no-results only count while the Search view is on screen.
    Each state honours its own show/suppress flag from Settings (config.gui
    .mascot); a disabled state hides Vexter for that moment only. Returns
    `null` when nothing is active. */
export function useMascotState(): Accessor<ActiveMascotState | null> {
  const store = useAppStore();

  return createMemo<ActiveMascotState | null>(() => {
    const m = store.config()?.gui.mascot;
    const show = (k: "show_searching" | "show_indexing" | "show_nothing") => (m ? m[k] : true);

    if (store.indexing() || store.indexProgress() !== null) {
      return show("show_indexing") ? "indexing" : null;
    }
    if (store.view() === "search") {
      if (store.searchState() === "searching") return show("show_searching") ? "searching" : null;
      if (store.searchState() === "done" && store.results().length === 0)
        return show("show_nothing") ? "nothing" : null;
    }
    return null;
  });
}
