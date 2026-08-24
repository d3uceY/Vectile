import { useAppStore } from "../../lib/store";
import { Kbd } from "../ui/primitives";

/** Top strip: the model-engine state on the left, library summary on the
    right. Gives the "everything okay" read at a glance on every view. */
export function StatusStrip() {
  const store = useAppStore();
  const totals = () => {
    const cols = store.collections();
    return {
      collections: cols.length,
      chunks: cols.reduce((n, c) => n + c.chunks, 0),
      size: "4.8 MB",
    };
  };
  const onSearch = () => store.view() !== "search" && store.focusSearch();

  return (
    <header class="flex h-13 shrink-0 items-center justify-between border-b border-line bg-paper/70 px-6">
      <div class="flex items-center gap-4">
        <span class="data text-faint">all local</span>
        <span class="h-3 w-px bg-line-strong" aria-hidden="true" />
        <span class="data text-faint">
          {totals().collections} collections · {totals().chunks.toLocaleString()} chunks ·{" "}
          {totals().size}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-2 rounded-control px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-surface hover:text-ink"
          onClick={onSearch}
        >
          Jump to search
          <Kbd>{navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}</Kbd>
        </button>
      </div>
    </header>
  );
}
