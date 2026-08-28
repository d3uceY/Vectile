import { createMemo, createSignal, For, Show, type JSX } from "solid-js";
import { CheckIcon, ChevronDown, ChevronRight, FileIcon, FolderIcon, FolderOpenIcon } from "./icons";

export type TreeViewElement = {
  id: string;
  name: string;
  type?: "file" | "folder";
  isSelectable?: boolean;
  children?: TreeViewElement[];
};

type Sort = "default" | "none" | ((a: TreeViewElement, b: TreeViewElement) => number);

interface Row {
  node: TreeViewElement;
  depth: number;
  hasChildren: boolean;
}

function isFolder(n: TreeViewElement): boolean {
  return n.type === "folder" || (n.children?.length ?? 0) > 0;
}

function sortNodes(nodes: TreeViewElement[], sort: Sort): TreeViewElement[] {
  if (sort === "none") return nodes;
  const cmp = typeof sort === "function" ? sort : (a: TreeViewElement, b: TreeViewElement) =>
      a.name.localeCompare(b.name);
  const folders = nodes.filter(isFolder).sort(cmp);
  const files = nodes.filter((n) => !isFolder(n)).sort(cmp);
  return [...folders, ...files];
}

export function FileTree(props: {
  elements: TreeViewElement[];
  initialSelectedId?: string;
  initialExpandedItems?: string[];
  indicator?: boolean;
  openIcon?: JSX.Element;
  closeIcon?: JSX.Element;
  fileIcon?: JSX.Element;
  sort?: Sort;
  dir?: "ltr" | "rtl";
  onSelect?: (id: string, node: TreeViewElement) => void;
  showExpandAll?: boolean;
  class?: string;
  /** Show a checkbox on leaf nodes (for bulk select). Clicking it toggles
      the check without selecting the row. */
  checkable?: boolean;
  isChecked?: (id: string) => boolean;
  onToggleCheck?: (id: string, node: TreeViewElement) => void;
}) {
  const [selectedId, setSelectedId] = createSignal<string>(props.initialSelectedId ?? "");
  const [expanded, setExpanded] = createSignal<Set<string>>(
    new Set(props.initialExpandedItems ?? []),
  );
  const sort = props.sort ?? "default";
  const dir = props.dir ?? "ltr";
  const indicator = props.indicator ?? true; // vertical guide lines for nesting

  const visible = createMemo<Row[]>(() => {
    const out: Row[] = [];
    const walk = (nodes: TreeViewElement[], depth: number) => {
      for (const n of sortNodes(nodes, sort)) {
        const hc = isFolder(n);
        out.push({ node: n, depth, hasChildren: hc });
        if (hc && expanded().has(n.id)) walk(n.children ?? [], depth + 1);
      }
    };
    walk(props.elements, 0);
    return out;
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (row: Row) => {
    if (row.node.isSelectable === false) return;
    setSelectedId(row.node.id);
    props.onSelect?.(row.node.id, row.node);
  };

  const rows = () => visible();
  let refs: (HTMLButtonElement | undefined)[] = [];

  const focusAt = (i: number) => {
    const r = refs[i];
    if (r) {
      r.focus();
      const row = rows()[i];
      if (row) setSelectedId(row.node.id);
    }
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const row = rows()[i];
    if (!row) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt(Math.min(i + 1, rows().length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(Math.max(i - 1, 0));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (row.hasChildren) {
        if (!expanded().has(row.node.id)) toggle(row.node.id);
        else focusAt(i + 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (row.hasChildren && expanded().has(row.node.id)) toggle(row.node.id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (row.hasChildren) toggle(row.node.id);
      else select(row);
    }
  };

  const allExpanded = () => visible().length === flattenedCount(props.elements, sort);
  const flattenedCount = (nodes: TreeViewElement[], s: Sort): number => {
    let n = 0;
    const w = (list: TreeViewElement[]) => {
      for (const node of sortNodes(list, s)) {
        n++;
        if (isFolder(node) && node.children) w(node.children);
      }
    };
    w(nodes);
    return n;
  };

  const toggleAll = () =>
    setExpanded((prev) => {
      if (allExpanded()) return new Set<string>();
      const all = new Set<string>();
      const w = (nodes: TreeViewElement[]) => {
        for (const node of sortNodes(nodes, sort)) {
          if (isFolder(node)) {
            all.add(node.id);
            if (node.children) w(node.children);
          }
        }
      };
      w(props.elements);
      return all;
    });

  return (
    <div class={props.class}>
      <Show when={props.showExpandAll}>
        <button
          class="mb-1 flex items-center gap-1.5 px-1 text-[12px] text-faint transition-colors hover:text-leaf"
          onClick={toggleAll}
        >
          <ChevronDown size={12} class={allExpanded() ? "rotate-180 transition-transform" : "transition-transform"} />
          {allExpanded() ? "Collapse all" : "Expand all"}
        </button>
      </Show>
      <div role="tree" aria-label="Indexed files" dir={dir}>
        <For each={rows()}>
          {(row, i) => (
            <button
              ref={(el) => (refs[i()] = el)}
              role="treeitem"
              aria-selected={selectedId() === row.node.id}
              aria-expanded={row.hasChildren ? expanded().has(row.node.id) : undefined}
              aria-level={row.depth + 1}
              onClick={() => (row.hasChildren ? toggle(row.node.id) : select(row))}
              onKeyDown={(e) => onKeyDown(e, i())}
              class={`group relative flex w-full items-center gap-1.5 rounded-lg px-1.5 py-0.75 text-left text-[13px] transition-colors duration-100 ease-snappy ${
                selectedId() === row.node.id
                  ? "bg-mint text-ink"
                  : "text-ink-soft hover:bg-surface"
              } ${row.node.isSelectable === false ? "cursor-default" : "cursor-pointer"}`}
              style={{ "padding-inline-start": `${8 + row.depth * 16}px` }}
            >
              <Show when={indicator && row.depth > 0}>
                <span
                  aria-hidden="true"
                  class="pointer-events-none absolute inset-y-0 w-px bg-line-strong/70"
                  style={{ left: `${8 + row.depth * 16}px` }}
                />
              </Show>
              <Show when={props.checkable && !row.hasChildren}>
                <span
                  role="checkbox"
                  aria-checked={props.isChecked?.(row.node.id) ?? false}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    props.onToggleCheck?.(row.node.id, row.node);
                  }}
                  class={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-100 ease-snappy ${
                    props.isChecked?.(row.node.id)
                      ? "border-leaf bg-leaf text-white"
                      : "border-line-strong bg-paper text-transparent hover:border-leaf/60"
                  }`}
                >
                  <CheckIcon size={11} strokeWidth={2.5} />
                </span>
              </Show>
              <span
                class={`flex h-4 w-4 shrink-0 items-center justify-center text-faint transition-transform duration-150 ease-snappy ${
                  row.hasChildren ? (expanded().has(row.node.id) ? "rotate-90" : "") : "opacity-0"
                }`}
              >
                <ChevronRight size={12} />
              </span>
              <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                {row.hasChildren
                  ? expanded().has(row.node.id)
                    ? (props.openIcon ?? <FolderOpenIcon size={15} class="text-leaf" />)
                    : (props.closeIcon ?? <FolderIcon size={15} class="text-faint" />)
                  : (props.fileIcon ?? <FileIcon size={14} class="text-faint" />)}
              </span>
              <span class="truncate">{row.node.name}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
