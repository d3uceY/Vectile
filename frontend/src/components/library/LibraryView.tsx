import { createSignal, For, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { ChevronDown, LibraryIcon, TrashIcon } from "../ui/icons";
import { Button, Chip, ConfirmDialog, EmptyState, ViewHeading } from "../ui/primitives";
import { GridPattern } from "../ui/patterns";

const typeLabel: Record<string, string> = {
  system: "system",
  project: "project",
  code: "code",
};

function TypeBadge(props: { type: string }) {
  const label = typeLabel[props.type] ?? props.type;
  return props.type === "code" ? (
    <Chip tone="code">{label}</Chip>
  ) : props.type === "project" ? (
    <Chip tone="mint">{label}</Chip>
  ) : (
    <Chip>{label}</Chip>
  );
}

export function LibraryView() {
  const store = useAppStore();
  const open = () => store.expandedCollection();

  const toggle = (id: number) => {
    const next = open() === String(id) ? null : String(id);
    store.setExpandedCollection(next);
    if (next !== null) void store.loadSources(id);
  };

  // Confirmation state for deleting a collection or a source. The whole row
  // toggles expansion, so the delete affordance is a sibling button, not a
  // nested one.
  const [confirm, setConfirm] = createSignal<
    | { kind: "collection"; id: number; name: string; type: string; chunks: number }
    | { kind: "source"; id: number; name: string; path: string; chunks: number }
    | null
  >(null);
  const [deleting, setDeleting] = createSignal(false);

  const doDelete = async () => {
    const t = confirm();
    if (!t) return;
    setDeleting(true);
    const ok =
      t.kind === "collection"
        ? await store.deleteCollection(t.name, t.name)
        : await store.deleteSource(t.id, t.path.split(/[\\/]/).pop() || t.path);
    setDeleting(false);
    if (ok) setConfirm(null);
  };

  return (
    <div class="relative flex h-full flex-col">
      <div class="pointer-events-none absolute inset-0 text-leaf/[0.05]">
        <GridPattern width={40} height={40} />
      </div>
      <div class="relative">
        <ViewHeading
          title="Library"
          note="every collection you've indexed, with its files and chunk counts"
        />
      </div>

      <div class="scroll-quiet relative min-h-0 flex-1 overflow-y-auto">
        <Show
          when={store.collections().length > 0}
          fallback={
            <div class="flex h-full items-center justify-center">
              <EmptyState
                icon={<LibraryIcon size={20} />}
                title="No collections yet"
                note="Index an Obsidian vault, a project folder, a Calibre library, or a code repo, and it lands here as a collection you can browse."
              >
                <Button onClick={() => store.setView("settings")}>
                  Add sources in Settings
                </Button>
              </EmptyState>
            </div>
          }
        >
        <div class="sheet overflow-hidden">
          <div class="grid grid-cols-12 gap-2 border-b border-line bg-surface/50 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            <span class="col-span-5">Collection</span>
            <span class="col-span-3">Sources</span>
            <span class="col-span-2 text-right">Chunks</span>
            <span class="col-span-2 text-right">Indexed</span>
          </div>
          <ul class="divide-y divide-line">
            <For each={store.collections()}>
              {(c) => {
                const isOpen = () => open() === String(c.id);
                const sources = () => store.sources().filter((s) => s.collectionId === c.id);
                return (
                  <li>
                    <div class="flex items-stretch">
                      <button
                        class={`grid flex-1 grid-cols-12 items-center gap-2 px-5 py-3.5 text-left transition-colors duration-100 ease-snappy ${
                          isOpen() ? "bg-mint/40" : "hover:bg-surface"
                        }`}
                        onClick={() => toggle(c.id)}
                        aria-expanded={isOpen()}
                      >
                        <span class="col-span-6 flex items-center gap-2.5">
                          <ChevronDown
                            size={14}
                            class={`shrink-0 text-faint transition-transform duration-150 ease-snappy ${
                              isOpen() ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                          <span class="flex min-w-0 items-center gap-2">
                            <span class="title truncate text-[14px] text-ink">{c.name}</span>
                            <TypeBadge type={c.type} />
                          </span>
                        </span>
                        <span class="data col-span-2 text-muted">{sources().length} files</span>
                        <span class="data col-span-2 text-right text-muted">
                          {c.chunks.toLocaleString()}
                        </span>
                        <span class="data col-span-2 text-right text-faint">{c.created}</span>
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center px-3.5 text-faint opacity-0 transition-opacity duration-100 ease-snappy hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={() =>
                          setConfirm({
                            kind: "collection",
                            id: c.id,
                            name: c.name,
                            type: c.type,
                            chunks: c.chunks,
                          })
                        }
                        aria-label={`Delete collection ${c.name}`}
                        title={`Delete ${c.name} from the index and Settings`}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>

                    <Show when={isOpen()}>
                      <div class="border-t border-line bg-paper/70 px-6 py-3">
                        <p class="data mb-2 text-faint">{c.description}</p>
                        <ul class="space-y-1">
                          <For each={sources()}>
                            {(s) => (
                              <li class="group flex items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 hover:bg-surface">
                                <span class="data shrink-0 text-leaf-deep">{s.sourceType}</span>
                                <span class="h-3 w-px shrink-0 bg-line-strong" aria-hidden="true" />
                                <span class="data min-w-0 flex-1 truncate text-ink-soft">{s.path}</span>
                                <span class="data shrink-0 text-faint">{s.chunks} chunks</span>
                                <button
                                  type="button"
                                  class="shrink-0 text-faint opacity-0 transition-opacity duration-100 ease-snappy hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                                  onClick={() =>
                                    setConfirm({
                                      kind: "source",
                                      id: s.id,
                                      name: s.path.split(/[\\/]/).pop() || s.path,
                                      path: s.path,
                                      chunks: s.chunks,
                                    })
                                  }
                                  aria-label={`Delete source ${s.path}`}
                                  title={`Remove ${s.path} from the index`}
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </li>
                            )}
                          </For>
                          <Show when={sources().length === 0}>
                            <li class="data px-2 py-1 text-faint">No sources indexed yet.</li>
                          </Show>
                        </ul>
                      </div>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>

        <div class="mt-4 flex items-center gap-2 text-[12.5px] text-muted">
          <LibraryIcon size={14} class="text-faint" />
          <span>Deleting or moving a file prunes it from search automatically. No stale results.</span>
        </div>
        </Show>
      </div>

      <ConfirmDialog
        open={confirm() !== null}
        title={confirm()?.kind === "collection" ? `Delete ${confirm()!.name}?` : "Remove this file from the index?"}
        busy={deleting()}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doDelete()}
        body={(() => {
          const t = confirm();
          if (t?.kind === "collection") {
            return (
              <p>
                Removes <span class="font-medium text-ink">“{t.name}”</span> and its{" "}
                <span class="font-medium text-ink">{t.chunks.toLocaleString()} chunks</span> from
                the index, and removes it from Settings
                {t.type === "system" ? " (all its vault/library paths)." : " (the whole group)."}{" "}
                The files on disk are untouched — re-add the source in Settings to index it again.
              </p>
            );
          }
          return (
            <p>
              Removes <span class="font-medium text-ink">“{t?.name}”</span> and its{" "}
              <span class="font-medium text-ink">{t?.chunks.toLocaleString()} chunks</span> from the
              index. The file stays on disk and the path stays configured, so a re-index can bring
              it back.
            </p>
          );
        })()}
      />
    </div>
  );
}
