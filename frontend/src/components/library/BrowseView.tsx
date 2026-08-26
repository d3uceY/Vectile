import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { FileTree, type TreeViewElement } from "../ui/FileTree";
import { ViewHeading, Button, Chip, EmptyState, Skeleton } from "../ui/primitives";
import { BrowseIcon } from "../ui/icons";
import { GridPattern } from "../ui/patterns";

// Tree node ids must be unique across the whole tree, but collection/source/
// document ids each autoincrement from 1, so a source folder "1" used to
// collide with the collection folder "1" and collapsing one collapsed its
// same-id parent too. Prefix each namespace; the prefix is internal to the
// tree only.
const cid = (n: number) => `c-${n}`; // collection folder
const sid = (n: number) => `s-${n}`; // source folder
const did = (n: number) => `d-${n}`; // document (file)

export function BrowseView() {
  const store = useAppStore();
  const [loaded, setLoaded] = createSignal(false);

  const tree = createMemo<TreeViewElement[]>(() =>
    store.collections().map((c) => ({
      id: cid(c.id),
      name: c.name,
      type: "folder" as const,
      children: store
        .sources()
        .filter((s) => s.collectionId === c.id)
        .map((s) => ({
          id: sid(s.id),
          name: s.path.split(/[\\/]/).pop() || s.path,
          type: "folder" as const,
          children: store
            .documents()
            .filter((d) => d.sourceId === s.id)
            .map((d) => ({ id: did(d.id), name: d.title, type: "file" as const })),
        })),
    })),
  );

  const initialExpanded = createMemo(() => {
    const out: string[] = [];
    const first = store.collections()[0];
    if (first) out.push(cid(first.id));
    const firstSource = store.sources().find((s) => s.collectionId === first?.id);
    if (firstSource) out.push(sid(firstSource.id));
    return out;
  });

  const doc = () => {
    const sel = store.selectedDoc();
    if (sel) return sel;
    return store.documents()[0] ?? null;
  };

  const onSelect = (tid: string) => {
    const d = store.documents().find((x) => did(x.id) === tid);
    if (d) store.setSelectedDoc(d);
  };

  onMount(() => {
    void store.loadLibrary().then(() => setLoaded(true));
  });
  onCleanup(() => setLoaded(false));

  return (
    <div class="relative flex h-full flex-col">
      {/* The graph-paper moment for browsing the stack */}
      <div class="pointer-events-none absolute inset-0 text-leaf/[0.07]">
        <GridPattern width={34} height={34} />
      </div>

      <div class="relative">
        <ViewHeading title="Browse" note="collections, files, and the chunks inside them" />
      </div>

      <div class="relative @container min-h-0 flex-1">
        <Show
          when={loaded() && store.documents().length > 0}
          fallback={
            <div class="flex h-full items-center justify-center">
              <Show when={loaded()} fallback={<BrowseLoading />}>
                <EmptyState
                  icon={<BrowseIcon size={20} />}
                  title={
                    store.collections().length > 0
                      ? "Indexed, but nothing to show yet"
                      : "Nothing to browse yet"
                  }
                  note={
                    store.collections().length > 0
                      ? "Your sources are set up, but no documents have been indexed yet. Run an index pass and their files and chunks will show up here."
                      : "Index an Obsidian vault, a project folder, a Calibre library, or a code repo, and its files and chunks show up here."
                  }
                >
                  <Button
                    onClick={() =>
                      store.setView(store.collections().length > 0 ? "index" : "settings")
                    }
                  >
                    {store.collections().length > 0 ? "Go to Index" : "Add sources in Settings"}
                  </Button>
                </EmptyState>
              </Show>
            </div>
          }
        >
        <div class="flex h-full min-h-0 flex-col gap-4 @lg:grid @lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div class="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto p-3">
            <FileTree
              elements={loaded() ? tree() : []}
              initialSelectedId={doc() ? did(doc()!.id) : undefined}
              initialExpandedItems={initialExpanded()}
              onSelect={onSelect}
              showExpandAll
            />
          </div>

          <Show when={doc()} fallback={<div class="sheet min-h-0 flex-1" />}>
            {(d) => {
              const src = () => store.sources().find((s) => s.id === d().sourceId);
              const col = () => store.collections().find((c) => c.id === d().collectionId);
              const tags = () => {
                const t = (d().metadata as Record<string, unknown> | null)?.tags;
                return Array.isArray(t) ? (t as string[]) : [];
              };
              return (
                <div class="sheet flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div class="border-b border-line bg-surface/50 px-5 py-4">
                    <h3 class="title text-[16px] leading-6 tracking-[-0.005em] text-ink">
                      {d().title}
                    </h3>
                    <p class="data mt-1.5 truncate text-faint">{src()?.path ?? ""}</p>
                    <div class="mt-3 flex flex-wrap items-center gap-1.5">
                      <Chip tone="mint">{col()?.name ?? String(d().collectionId)}</Chip>
                      <span class="data text-faint">chunk {d().chunkIndex + 1}</span>
                      {tags().length > 0 && (
                        <span class="data text-faint">{tags().map((t) => `#${t}`).join(" ")}</span>
                      )}
                    </div>
                  </div>
                  <div class="scroll-quiet min-h-0 flex-1 overflow-y-auto p-5">
                    <p class="read whitespace-pre-wrap text-[15px] leading-[1.7] text-ink-soft">
                      {d().content}
                    </p>
                  </div>
                </div>
              );
            }}
          </Show>
        </div>
        </Show>
      </div>
    </div>
  );
}

function BrowseLoading() {
  return (
    <div class="sheet h-full w-full max-w-[20rem] p-4">
      <Skeleton class="mb-3 h-6 w-2/3" />
      <Skeleton class="mb-2 h-4 w-full" />
      <Skeleton class="mb-2 h-4 w-5/6" />
      <Skeleton class="mb-2 h-4 w-3/4" />
      <Skeleton class="h-4 w-2/3" />
    </div>
  );
}
