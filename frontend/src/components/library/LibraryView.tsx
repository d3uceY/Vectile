import { For, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { mockSources } from "../../lib/mock";
import type { CollectionType } from "../../lib/types";
import { ChevronDown, LibraryIcon } from "../ui/icons";
import { Chip, ViewHeading } from "../ui/primitives";
import { GridPattern } from "../ui/patterns";

const typeLabel: Record<CollectionType, string> = {
  system: "system",
  project: "project",
  code: "code",
};

function TypeBadge(props: { type: CollectionType }) {
  return props.type === "code" ? (
    <Chip tone="code">{typeLabel[props.type]}</Chip>
  ) : props.type === "project" ? (
    <Chip tone="mint">{typeLabel[props.type]}</Chip>
  ) : (
    <Chip>{typeLabel[props.type]}</Chip>
  );
}

export function LibraryView() {
  const store = useAppStore();
  const open = () => store.expandedCollection();

  const toggle = (id: string) =>
    store.setExpandedCollection(open() === id ? null : id);

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

      <div class="relative flex-1">
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
                const isOpen = () => open() === c.id;
                const sources = () => mockSources.filter((s) => s.collectionId === c.id);
                return (
                  <li>
                    <button
                      class={`grid w-full grid-cols-12 items-center gap-2 px-5 py-3.5 text-left transition-colors duration-100 ease-snappy ${
                        isOpen() ? "bg-mint/40" : "hover:bg-surface"
                      }`}
                      onClick={() => toggle(c.id)}
                      aria-expanded={isOpen()}
                    >
                      <span class="col-span-5 flex items-center gap-2.5">
                        <ChevronDown
                          size={14}
                          class={`shrink-0 text-faint transition-transform duration-150 ease-snappy ${
                            isOpen() ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="truncate text-[14px] font-semibold text-ink">{c.name}</span>
                          <TypeBadge type={c.type} />
                        </span>
                      </span>
                      <span class="data col-span-3 text-muted">{sources().length} files</span>
                      <span class="data col-span-2 text-right text-muted">
                        {c.chunks.toLocaleString()}
                      </span>
                      <span class="data col-span-2 text-right text-faint">{c.created}</span>
                    </button>

                    <Show when={isOpen()}>
                      <div class="border-t border-line bg-paper/70 px-6 py-3">
                        <p class="data mb-2 text-faint">{c.description}</p>
                        <ul class="space-y-1">
                          <For each={sources()}>
                            {(s) => (
                              <li class="flex items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 hover:bg-surface">
                                <span class="data shrink-0 text-leaf-deep">{s.sourceType}</span>
                                <span class="h-3 w-px shrink-0 bg-line-strong" aria-hidden="true" />
                                <span class="data truncate text-ink-soft">{s.path}</span>
                                <span class="data ml-auto shrink-0 text-faint">
                                  {s.chunks} chunks
                                </span>
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
      </div>
    </div>
  );
}
