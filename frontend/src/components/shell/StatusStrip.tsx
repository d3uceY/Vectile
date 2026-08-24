import { useAppStore } from "../../lib/store";
import { Kbd } from "../ui/primitives";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Top strip: the model-engine state on the left, library summary on the
    right. Gives the "everything okay" read at a glance on every view. */
export function StatusStrip() {
  const store = useAppStore();
  const st = () => store.status();
  const totals = () => {
    const s = st();
    if (s) {
      return { collections: s.collections, chunks: s.chunks, size: formatBytes(s.dbSize) };
    }
    const cols = store.collections();
    return {
      collections: cols.length,
      chunks: cols.reduce((n, c) => n + c.chunks, 0),
      size: "",
    };
  };
  const onSearch = () => store.view() !== "search" && store.focusSearch();

  return (
    <header class="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-line bg-paper/70 px-6">
      <div class="flex min-w-0 items-center gap-4">
        <span class="data shrink-0 text-faint">all local</span>
        <span class="h-3 w-px shrink-0 bg-line-strong" aria-hidden="true" />
        <span class="data truncate text-faint">
          {totals().collections} collections · {totals().chunks.toLocaleString()} chunks
          {totals().size ? ` · ${totals().size}` : ""}
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <button
          class="flex items-center gap-2 rounded-control px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-surface hover:text-ink"
          onClick={onSearch}
        >
          <span class="hidden md:inline">Jump to search</span>
          <Kbd>{navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}</Kbd>
        </button>
      </div>
    </header>
  );
}
