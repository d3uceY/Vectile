import { createMemo, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { mockCollections, mockDocuments, mockSources } from "../../lib/mock";
import type { Document } from "../../lib/types";
import { FileTree, type TreeViewElement } from "../ui/FileTree";
import { ViewHeading, Chip } from "../ui/primitives";
import { GridPattern } from "../ui/patterns";

function buildBrowseTree(): TreeViewElement[] {
  return mockCollections.map((c) => ({
    id: c.id,
    name: c.name,
    type: "folder",
    children: mockSources
      .filter((s) => s.collectionId === c.id)
      .map((s) => ({
        id: s.id,
        name: s.path.split("/").pop() || s.path,
        type: "folder",
        children: mockDocuments
          .filter((d) => d.sourceId === s.id)
          .map((d) => ({ id: d.id, name: d.title, type: "file" as const })),
      })),
  }));
}

const docById = (id: string): Document | undefined =>
  mockDocuments.find((d) => d.id === id);

const sourcePathFor = (d: Document): string =>
  mockSources.find((s) => s.id === d.sourceId)?.path ?? "";

export function BrowseView() {
  const store = useAppStore();
  const tree = createMemo(() => buildBrowseTree());
  const initialExpanded = createMemo(() => {
    const first = mockCollections[0];
    const firstSource = mockSources.find((s) => s.collectionId === first?.id);
    return [first?.id, firstSource?.id].filter(Boolean) as string[];
  });
  const doc = () => store.selectedDoc() ?? docById("d1") ?? null;

  const onSelect = (id: string) => {
    const d = docById(id);
    if (d) store.setSelectedDoc(d);
  };

  return (
    <div class="relative flex h-full flex-col">
      {/* The graph-paper moment for browsing the stack */}
      <div class="pointer-events-none absolute inset-0 text-leaf/[0.07]">
        <GridPattern width={34} height={34} />
      </div>

      <div class="relative">
        <ViewHeading
          title="Browse"
          note="collections, files, and the chunks inside them"
        />
      </div>

      {/* Side-by-side when there's room; stacked panes when the content
          column gets tight (container query, not viewport — so it tracks
          whatever the sidebar and padding leave us). The container lives on
          a wrapper: an element can't query its own container. */}
      <div class="relative @container min-h-0 flex-1">
        <div class="flex h-full min-h-0 flex-col gap-4 @lg:grid @lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Tree */}
          <div class="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto p-3">
            <FileTree
              elements={tree()}
              initialSelectedId={doc()?.id}
              initialExpandedItems={initialExpanded()}
              onSelect={onSelect}
              showExpandAll
            />
          </div>

          {/* Preview */}
          <Show when={doc()} fallback={<div class="sheet min-h-0 flex-1" />}>
            {(d) => (
              <div class="sheet flex min-h-0 flex-1 flex-col overflow-hidden">
                <div class="border-b border-line bg-surface/50 px-5 py-4">
                  <h3 class="text-[16px] font-semibold leading-6 tracking-[-0.005em] text-ink">
                    {d().title}
                  </h3>
                  <p class="data mt-1.5 truncate text-faint">{sourcePathFor(d())}</p>
                  <div class="mt-3 flex flex-wrap items-center gap-1.5">
                    <Chip tone="mint">{d().collectionId}</Chip>
                    <span class="data text-faint">
                      chunk {d().chunkIndex + 1}
                    </span>
                    <Show when={typeof d().metadata.tags !== "undefined"}>
                      <span class="data text-faint">
                        {(d().metadata.tags as string[]).map((t) => `#${t}`).join(" ")}
                      </span>
                    </Show>
                  </div>
                </div>
                <div class="scroll-quiet min-h-0 flex-1 overflow-y-auto p-5">
                  <p class="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-ink-soft">
                    {d().content}
                  </p>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
