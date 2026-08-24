import { createEffect, createSignal, createUniqueId, For, Show, type JSX } from "solid-js";
import { useAppStore } from "../../lib/store";
import { pickFolder } from "../../lib/api";
import type { AppConfig, GUIConfig, SearchDefaults } from "../../lib/types";
import { Button, InfoTip, StatusPill, Toggle, ViewHeading } from "../ui/primitives";
import { CloseIcon, FolderOpenIcon } from "../ui/icons";

/* ---- small building blocks ---- */

function Section(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="sheet mb-5 p-5">
      <h2 class="title mb-1 text-[16px] tracking-[-0.01em] text-ink">{props.title}</h2>
      {props.note && <p class="note mb-4 text-[13.5px] leading-5 text-muted">{props.note}</p>}
      <div class="space-y-4">{props.children}</div>
    </section>
  );
}

function NumField(props: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  const uid = createUniqueId();
  return (
    <div class="flex items-center justify-between gap-4">
      <span class="flex items-center gap-1.5 text-[13.5px] text-ink-soft">
        <label for={uid} class="cursor-pointer">
          {props.label}
        </label>
        {props.hint && <InfoTip text={props.hint} />}
      </span>
      <input
        id={uid}
        type="number"
        value={props.value}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        class="h-8 w-24 rounded-control border border-line bg-paper px-2 text-right text-[13px] outline-none focus:border-leaf"
      />
    </div>
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
              hint="How many chunks get fed to the model at once. A bigger number finishes indexing faster but uses more memory while it runs. If a large library makes the app stall, drop it to something like 16."
            />
          </Section>

          <Section title="Chunking" note="Word-based windows. Smaller chunks match tighter; overlap keeps straddling sentences intact.">
            <NumField
              label="Chunk size (words)"
              value={draft()!.chunk_size_tokens}
              onChange={(n) => setNumber("chunk_size_tokens", n)}
              hint="How many words each indexed slice of a document holds. Search matches against these slices, not whole files, so this sets how finely results are cut. Small chunks answer narrowly, big ones carry more surrounding context. 500 is a safe starting point."
            />
            <NumField
              label="Chunk overlap (words)"
              value={draft()!.chunk_overlap_tokens}
              onChange={(n) => setNumber("chunk_overlap_tokens", n)}
              hint="How many words repeat from one slice into the next. The repeat keeps sentences and ideas that straddle a cut from being split in half, so they still search whole. Too little overlap and things slip through; too much and the same text gets stored twice. 50 is the usual starting point."
            />
          </Section>

          <Section title="Search" note="Hybrid ranking blends exact-term and meaning results.">
            <NumField
              label="Top results"
              value={draft()!.search_defaults.top_k}
              onChange={(n) => setSearch("top_k", n)}
              hint="How many matches a search returns by default. Raise it to see more of the pile, lower it to keep the list short. You can still ask for a different number on any individual search."
            />
            <NumField
              label="RRF constant (k)"
              value={draft()!.search_defaults.rrf_k}
              onChange={(n) => setSearch("rrf_k", n)}
              hint="A smoothing value in the math that merges the two search lists. Bigger k flattens the gap between high and low ranked matches, so entries further down the list still get a fair shot. 60 is the standard value for this kind of search."
            />
            <NumField
              label="Vector weight"
              value={draft()!.search_defaults.vector_weight}
              onChange={(n) => setSearch("vector_weight", n)}
              hint="How much the meaning-based ranking counts when the two search lists are blended. It works against the full-text weight like a seesaw: raise it and results lean toward semantic matches, even when the words don't line up exactly."
            />
            <NumField
              label="Full-text weight"
              value={draft()!.search_defaults.fts_weight}
              onChange={(n) => setSearch("fts_weight", n)}
              hint="How much exact-word matches count in the final blend. Raise it when you're hunting a precise phrase or a name and want literal hits to win. Lower it and meaning takes over from wording."
            />
          </Section>

          <Section title="Sources" note="Folders are walked recursively. Code repositories discover nested git repos automatically.">
            <div class="grid gap-6 md:grid-cols-2">
              <div>
                <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  Obsidian vaults
                  <InfoTip text="Point at an Obsidian vault and every markdown note in it gets indexed, subfolders included. Once it's in, you can search your notes by meaning as well as by keyword. Use the exclude list below to keep noisy folders out." />
                </p>
                <PathList
                  values={draft()!.obsidian_vaults}
                  onAdd={(v) => addPath("obsidian_vaults", v)}
                  onRemove={(v) => removePath("obsidian_vaults", v)}
                  title="Choose an Obsidian vault"
                />
              </div>
              <div>
                <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  Obsidian exclude folders
                  <InfoTip text="Folders listed here are skipped when vaults are indexed. Handy for hiding attachments, templates, .trash, or anything else you don't want showing up in search results." />
                </p>
                <PathList
                  values={draft()!.obsidian_exclude_folders}
                  onAdd={(v) => addPath("obsidian_exclude_folders", v)}
                  onRemove={(v) => removePath("obsidian_exclude_folders", v)}
                  title="Choose a folder to exclude"
                />
              </div>
              <div>
                <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  Calibre libraries
                  <InfoTip text="Point at a Calibre library and the app reads your book metadata and indexes the text of the formats it understands, so your books become searchable without opening them." />
                </p>
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
                <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  Project folders
                  <InfoTip text="A group of folders that get indexed together as one collection. Each group you create becomes its own searchable set, so you can keep client work separate from personal files. Folders are walked recursively." />
                </p>
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
                <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  Code repositories
                  <InfoTip text="Git repositories to index as code. The app indexes the current file tree and the commit history (how far back is set below), including any nested repos it finds, and makes the code itself searchable by meaning." />
                </p>
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
            <NumField
              label="Commit history (months)"
              value={draft()!.git_history_in_months}
              onChange={(n) => setNumber("git_history_in_months", n)}
              hint="How many months of git history get indexed for a repository. Each commit becomes a searchable document, so this controls how far back you can dig through your changelog. 6 months is the default."
            />
            <Toggle
              checked={draft()!.gui.auto_reindex}
              onChange={(v) => setGui({ auto_reindex: v })}
              label="Auto-reindex"
              description="Re-index all enabled collections on a timer."
              hint="Re-index all your collections on a timer in the background, so files you add or edit show up in search without you running anything manually. Off by default, since a full pass can use your CPU and model for a while. Turn it on if you're constantly adding files."
            />
            <Show when={draft()!.gui.auto_reindex}>
              <NumField
                label="Interval (minutes)"
                value={draft()!.gui.auto_reindex_interval_minutes}
                onChange={(n) => setGui({ auto_reindex_interval_minutes: n })}
                hint="How often the auto-reindex timer fires. 60 means once an hour. Only matters when Auto-reindex is switched on."
              />
            </Show>
            <Toggle
              checked={draft()!.gui.start_on_login}
              onChange={(v) => setGui({ start_on_login: v })}
              label="Start on login"
              description="Launch vectile when you sign in."
              hint="Launch vectile automatically when you sign in to your computer, so it's already open and indexing before you need it."
            />
          </Section>
        </div>
      </Show>
    </div>
  );
}
