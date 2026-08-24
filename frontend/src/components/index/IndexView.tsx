import { For, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { Button, Chip, EmptyState, Toggle, ViewHeading } from "../ui/primitives";
import { IndexIcon } from "../ui/icons";

type Configured = { name: string; type: string; enabled: boolean };

export function IndexView() {
  const store = useAppStore();

  const configured = (): Configured[] => {
    const cfg = store.config();
    if (!cfg) return [];
    const disabled = new Set(cfg.disabled_collections);
    const list: Configured[] = [];
    if (cfg.obsidian_vaults.length) list.push({ name: "obsidian", type: "system", enabled: !disabled.has("obsidian") });
    if (cfg.calibre_libraries.length) list.push({ name: "calibre", type: "system", enabled: !disabled.has("calibre") });
    for (const [name, paths] of Object.entries(cfg.projects)) {
      if (paths.length) list.push({ name, type: "project", enabled: !disabled.has(name) });
    }
    for (const [name, paths] of Object.entries(cfg.repositories)) {
      if (paths.length) list.push({ name, type: "code", enabled: !disabled.has(name) });
    }
    return list;
  };

  const dbCol = (name: string) => store.collections().find((c) => c.name === name);
  const progress = store.indexProgress();
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div class="relative flex h-full flex-col">
      <ViewHeading title="Index" note="Add sources in Settings, then index them here. Deleted files are pruned automatically.">
        <Button onClick={() => store.startIndexAll(false)} disabled={store.indexing()}>
          Index all
        </Button>
      </ViewHeading>

      {/* Live progress */}
      <Show when={store.indexing() && progress}>
        <div class="sheet mb-5 p-5">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="data text-leaf-deep">indexing {progress!.collection}</span>
            <span class="data text-faint">{pct}% · {progress!.current}/{progress!.total}</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div class="h-full rounded-full bg-leaf transition-[width] duration-200 ease-snappy" style={{ width: `${pct}%` }} />
          </div>
          <p class="data mt-2 truncate text-muted">{progress!.item}</p>
        </div>
      </Show>

      {/* Last run summary */}
      <Show when={!store.indexing() && store.indexLast()}>
        <div class="mb-5 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface/40 px-4 py-2.5">
          <span class="data text-muted">last: {store.indexLast()!.collection}</span>
          <Chip tone="mint">{store.indexLast()!.indexed} new</Chip>
          <Show when={store.indexLast()!.skipped > 0}>
            <Chip>{store.indexLast()!.skipped} skipped</Chip>
          </Show>
          <Show when={store.indexLast()!.errors > 0}>
            <Chip tone="neutral">{store.indexLast()!.errors} errors</Chip>
          </Show>
        </div>
      </Show>

      {/* Collection rows */}
      <Show
        when={configured().length > 0}
        fallback={
          <div class="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<IndexIcon size={20} />}
              title="Nothing configured yet"
              note="Add an Obsidian vault, a project folder, a Calibre library, or a code repo under Settings."
            >
              <Button onClick={() => store.setView("settings")}>
                Add sources in Settings
              </Button>
            </EmptyState>
          </div>
        }
      >
        <div class="scroll-quiet -mr-2 flex-1 space-y-3 overflow-y-auto pr-2">
          <For each={configured()}>
            {(item) => {
              const col = () => dbCol(item.name);
              return (
                <div class="sheet flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="title truncate text-[15px] tracking-[-0.01em] text-ink">{item.name}</span>
                      <Chip tone={item.type === "code" ? "code" : "neutral"}>{item.type}</Chip>
                      {!item.enabled && <Chip>disabled</Chip>}
                    </div>
                    <p class="data mt-1 text-faint">
                      {col() ? `${col()!.sources} sources · ${col()!.chunks.toLocaleString()} chunks` : "not indexed yet"}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={store.indexing() || !item.enabled}
                      onClick={() => store.startIndex(item.name, false)}
                    >
                      Index
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={store.indexing() || !item.enabled}
                      onClick={() => store.startIndex(item.name, true)}
                    >
                      Re-index
                    </Button>
                    <Button size="sm" variant="ghost" disabled={store.indexing()} onClick={() => store.runPrune(item.name)}>
                      Prune
                    </Button>
                    <Toggle checked={item.enabled} onChange={(v) => store.toggleCollection(item.name, v)} label="Enabled" />
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
