import { createEffect, createSignal, For, Show, type JSX } from "solid-js";
import { useAppStore } from "../../lib/store";
import { pickFolder } from "../../lib/api";
import type { AppConfig, GUIConfig, SearchDefaults } from "../../lib/types";
import { Button, StatusPill, Toggle, ViewHeading } from "../ui/primitives";
import { CloseIcon, FolderOpenIcon } from "../ui/icons";

/* ---- small building blocks ---- */

function Section(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="sheet mb-5 p-5">
      <h2 class="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">{props.title}</h2>
      {props.note && <p class="note mb-4 text-[13.5px] leading-5 text-muted">{props.note}</p>}
      <div class="space-y-4">{props.children}</div>
    </section>
  );
}

function NumField(props: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label class="flex items-center justify-between gap-4">
      <span class="text-[13.5px] text-ink-soft">{props.label}</span>
      <input
        type="number"
        value={props.value}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        class="h-8 w-24 rounded-control border border-line bg-paper px-2 text-right text-[13px] outline-none focus:border-leaf"
      />
    </label>
  );
}

function PathList(props: {
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  title?: string;
}) {
  const [input, setInput] = createSignal("");

  const addInput = () => {
    if (input().trim()) {
      props.onAdd(input().trim());
      setInput("");
    }
  };

  const browse = async () => {
    const dir = await pickFolder(props.title);
    if (dir) props.onAdd(dir);
  };

  return (
    <div class="flex flex-col gap-1.5">
      <ul class="flex flex-col gap-1">
        <For each={props.values}>
          {(v) => (
            <li class="flex items-center gap-2 rounded-control border border-line bg-paper px-3 py-1.5">
              <span class="data flex-1 truncate text-muted" title={v}>{v}</span>
              <button
                class="shrink-0 text-faint transition-colors hover:text-danger"
                onClick={() => props.onRemove(v)}
                aria-label={`Remove ${v}`}
              >
                <CloseIcon size={14} />
              </button>
            </li>
          )}
        </For>
      </ul>
      <div class="flex gap-2">
        <input
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addInput();
          }}
          placeholder="/absolute/path"
          class="h-8 flex-1 rounded-control border border-line bg-paper px-3 text-[13px] outline-none focus:border-leaf"
          spellcheck={false}
        />
        <Button size="sm" variant="outline" onClick={() => void browse()} aria-label="Browse for folder">
          <FolderOpenIcon size={15} />
          Browse
        </Button>
        <Button size="sm" onClick={addInput}>
          Add
        </Button>
      </div>
    </div>
  );
}

function GroupList(props: {
  groups: Record<string, string[]>;
  onAddPath: (name: string, v: string) => void;
  onRemovePath: (name: string, v: string) => void;
  onAddGroup: (name: string) => void;
  onRemoveGroup: (name: string) => void;
  title?: string;
}) {
  const [name, setName] = createSignal("");
  return (
    <div class="space-y-3">
      <div class="flex gap-2">
        <input
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name().trim()) {
              props.onAddGroup(name().trim());
              setName("");
            }
          }}
          placeholder="collection name…"
          class="h-8 flex-1 rounded-control border border-line bg-paper px-3 text-[13px] outline-none focus:border-leaf"
        />
        <Button
          size="sm"
          onClick={() => {
            if (name().trim()) {
              props.onAddGroup(name().trim());
              setName("");
            }
          }}
        >
          New group
        </Button>
      </div>
      <For each={Object.entries(props.groups)}>
        {([gname, paths]) => (
          <div class="rounded-control border border-line bg-surface/40 p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="data font-medium text-ink">{gname}</span>
              <button
                class="text-faint transition-colors hover:text-danger"
                onClick={() => props.onRemoveGroup(gname)}
                aria-label={`Remove ${gname}`}
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <PathList
              values={paths}
              onAdd={(v) => props.onAddPath(gname, v)}
              onRemove={(v) => props.onRemovePath(gname, v)}
              title={props.title}
            />
          </div>
        )}
      </For>
    </div>
  );
}

/* ---- the view ---- */

const cloneCfg = (c: AppConfig): AppConfig => ({
  ...c,
  obsidian_vaults: [...c.obsidian_vaults],
  obsidian_exclude_folders: [...c.obsidian_exclude_folders],
  calibre_libraries: [...c.calibre_libraries],
  repositories: Object.fromEntries(Object.entries(c.repositories).map(([k, v]) => [k, [...v]])),
  projects: Object.fromEntries(Object.entries(c.projects).map(([k, v]) => [k, [...v]])),
  disabled_collections: [...c.disabled_collections],
  git_commit_subject_blacklist: [...c.git_commit_subject_blacklist],
  search_defaults: { ...c.search_defaults },
  gui: { ...c.gui },
});

export function SettingsView() {
  const store = useAppStore();
  const [draft, setDraft] = createSignal<AppConfig | null>(null);

  // Initialize the draft once from the loaded config.
  createEffect(() => {
    const c = store.config();
    if (c && !draft()) setDraft(cloneCfg(c));
  });

  const patch = (p: Partial<AppConfig>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setNumber = (
    k: "embedding_batch_size" | "chunk_size_tokens" | "chunk_overlap_tokens" | "git_history_in_months",
    n: number,
  ) => patch({ [k]: n } as Partial<AppConfig>);

  const addPath = (k: "obsidian_vaults" | "obsidian_exclude_folders" | "calibre_libraries", v: string) =>
    setDraft((d) => (d ? { ...d, [k]: [...d[k], v] } : d));
  const removePath = (k: "obsidian_vaults" | "obsidian_exclude_folders" | "calibre_libraries", v: string) =>
    setDraft((d) => (d ? { ...d, [k]: d[k].filter((x) => x !== v) } : d));

  const addGroupPath = (mapKey: "projects" | "repositories", name: string, v: string) =>
    setDraft((d) =>
      d ? { ...d, [mapKey]: { ...d[mapKey], [name]: [...(d[mapKey][name] ?? []), v] } } : d,
    );
  const removeGroupPath = (mapKey: "projects" | "repositories", name: string, v: string) =>
    setDraft((d) =>
      d
        ? { ...d, [mapKey]: { ...d[mapKey], [name]: (d[mapKey][name] ?? []).filter((x) => x !== v) } }
        : d,
    );
  const addGroup = (mapKey: "projects" | "repositories", name: string) =>
    setDraft((d) => (d ? { ...d, [mapKey]: { ...d[mapKey], [name]: [] } } : d));
  const removeGroup = (mapKey: "projects" | "repositories", name: string) =>
    setDraft((d) => {
      if (!d) return d;
      const m = { ...d[mapKey] };
      delete m[name];
      return { ...d, [mapKey]: m };
    });

  const setSearch = (k: keyof SearchDefaults, n: number) =>
    setDraft((d) => (d ? { ...d, search_defaults: { ...d.search_defaults, [k]: n } } : d));
  const setGui = (p: Partial<GUIConfig>) =>
    setDraft((d) => (d ? { ...d, gui: { ...d.gui, ...p } } : d));

  const save = async () => {
    const d = draft();
    if (d) await store.saveConfig(d);
  };

  return (
    <div class="relative flex h-full flex-col">
      <ViewHeading title="Settings" note="Model, chunking, search, and sources. Everything stays on this machine.">
        <Button onClick={() => void save()}>Save settings</Button>
      </ViewHeading>

      <Show when={draft()} fallback={<p class="note text-muted">Loading settings…</p>}>
        <div class="scroll-quiet -mr-2 flex-1 overflow-y-auto pr-2">
          <Section title="Model" note="The embedding engine runs in-process. Place bge-m3-Q4_K_M.gguf in the models folder of the vectile data directory.">
            <div class="flex flex-wrap items-center gap-3">
              <StatusPill state={store.modelState()} name={store.modelName()} />
            </div>
            <div class="data truncate text-muted" title={store.status()?.modelPath ?? ""}>
              {store.status()?.modelPath ?? "…"}
            </div>
            <NumField
              label="Embedding batch size"
              value={draft()!.embedding_batch_size}
              onChange={(n) => setNumber("embedding_batch_size", n)}
            />
          </Section>

          <Section title="Chunking" note="Word-based windows. Smaller chunks match tighter; overlap keeps straddling sentences intact.">
            <NumField label="Chunk size (words)" value={draft()!.chunk_size_tokens} onChange={(n) => setNumber("chunk_size_tokens", n)} />
            <NumField label="Chunk overlap (words)" value={draft()!.chunk_overlap_tokens} onChange={(n) => setNumber("chunk_overlap_tokens", n)} />
          </Section>

          <Section title="Search" note="Hybrid ranking blends exact-term and meaning results.">
            <NumField label="Top results" value={draft()!.search_defaults.top_k} onChange={(n) => setSearch("top_k", n)} />
            <NumField label="RRF constant (k)" value={draft()!.search_defaults.rrf_k} onChange={(n) => setSearch("rrf_k", n)} />
            <NumField label="Vector weight" value={draft()!.search_defaults.vector_weight} onChange={(n) => setSearch("vector_weight", n)} />
            <NumField label="Full-text weight" value={draft()!.search_defaults.fts_weight} onChange={(n) => setSearch("fts_weight", n)} />
          </Section>

          <Section title="Sources" note="Folders are walked recursively. Code repositories discover nested git repos automatically.">
            <div class="grid gap-6 md:grid-cols-2">
              <div>
                <p class="mb-2 text-[13px] font-medium text-ink-soft">Obsidian vaults</p>
                <PathList
                  values={draft()!.obsidian_vaults}
                  onAdd={(v) => addPath("obsidian_vaults", v)}
                  onRemove={(v) => removePath("obsidian_vaults", v)}
                  title="Choose an Obsidian vault"
                />
              </div>
              <div>
                <p class="mb-2 text-[13px] font-medium text-ink-soft">Obsidian exclude folders</p>
                <PathList
                  values={draft()!.obsidian_exclude_folders}
                  onAdd={(v) => addPath("obsidian_exclude_folders", v)}
                  onRemove={(v) => removePath("obsidian_exclude_folders", v)}
                  title="Choose a folder to exclude"
                />
              </div>
              <div>
                <p class="mb-2 text-[13px] font-medium text-ink-soft">Calibre libraries</p>
                <PathList
                  values={draft()!.calibre_libraries}
                  onAdd={(v) => addPath("calibre_libraries", v)}
                  onRemove={(v) => removePath("calibre_libraries", v)}
                  title="Choose a Calibre library"
                />
              </div>
            </div>
            <div class="grid gap-6 md:grid-cols-2">
              <div>
                <p class="mb-2 text-[13px] font-medium text-ink-soft">Project folders</p>
                <GroupList
                  groups={draft()!.projects}
                  onAddPath={(n, v) => addGroupPath("projects", n, v)}
                  onRemovePath={(n, v) => removeGroupPath("projects", n, v)}
                  onAddGroup={(n) => addGroup("projects", n)}
                  onRemoveGroup={(n) => removeGroup("projects", n)}
                  title="Choose a project folder"
                />
              </div>
              <div>
                <p class="mb-2 text-[13px] font-medium text-ink-soft">Code repositories</p>
                <GroupList
                  groups={draft()!.repositories}
                  onAddPath={(n, v) => addGroupPath("repositories", n, v)}
                  onRemovePath={(n, v) => removeGroupPath("repositories", n, v)}
                  onAddGroup={(n) => addGroup("repositories", n)}
                  onRemoveGroup={(n) => removeGroup("repositories", n)}
                  title="Choose a code repository"
                />
              </div>
            </div>
          </Section>

          <Section title="Indexing">
            <NumField label="Commit history (months)" value={draft()!.git_history_in_months} onChange={(n) => setNumber("git_history_in_months", n)} />
            <Toggle
              checked={draft()!.gui.auto_reindex}
              onChange={(v) => setGui({ auto_reindex: v })}
              label="Auto-reindex"
              description="Re-index all enabled collections on a timer."
            />
            <Show when={draft()!.gui.auto_reindex}>
              <NumField label="Interval (minutes)" value={draft()!.gui.auto_reindex_interval_minutes} onChange={(n) => setGui({ auto_reindex_interval_minutes: n })} />
            </Show>
            <Toggle
              checked={draft()!.gui.start_on_login}
              onChange={(v) => setGui({ start_on_login: v })}
              label="Start on login"
              description="Launch vectile when you sign in."
            />
          </Section>
        </div>
      </Show>
    </div>
  );
}
