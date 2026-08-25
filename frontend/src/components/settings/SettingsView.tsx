import { createEffect, createSignal, createUniqueId, For, Show, type JSX } from "solid-js";
import { useAppStore } from "../../lib/store";
import { importModel, pickFolder, pickModelFile } from "../../lib/api";
import type { AppConfig, GUIConfig, ModelInfo, SearchDefaults } from "../../lib/types";
import { Button, ConfirmDialog, InfoTip, Select, StatusPill, Toggle, ViewHeading } from "../ui/primitives";
import { CloseIcon, FolderOpenIcon } from "../ui/icons";

/* ---- hard bounds for numeric settings ----
   Every numeric field is clamped to these ranges on load and on change, and
   the <input>s carry min/max/step so spinners and native validation agree.
   The bounds reflect what the backend can actually use:

   - embedding_batch_size  : <1 would mean "no batching"; the indexer treats
     anything below 1 as 1 anyway.
   - chunk_size_tokens     : must be >= 1 or the window splitter never
     advances (infinite loop); above ~1500 words a chunk overflows the
     model's 2048-token context (backend/embeddings) and gets truncated.
   - chunk_overlap_tokens  : must stay strictly below chunk_size or the window
     splitter walks backwards into a negative slice bound (panic). 0 = none.
   - git_history_in_months : whole months; <1 runs `git log --since=0 months
     ago`, which is meaningless.
   - top_k / rrf_k         : RRF's denominator is (k + rank + 1) so it must
     stay positive; the vector candidate pool saturates around 200.
   - vector/fts weight     : blend weights live in [0, 1].
   - auto_reindex_interval : the backend clamps <1min to 1min already; 0
     would mean "re-index every tick". */
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

type NumBounds = { min: number; max: number; step: number };

const STATIC_BOUNDS: Record<
  | "embedding_batch_size"
  | "chunk_size_tokens"
  | "chunk_overlap_tokens"
  | "git_history_in_months"
  | "top_k"
  | "rrf_k"
  | "vector_weight"
  | "fts_weight"
  | "auto_reindex_interval_minutes",
  NumBounds
> = {
  embedding_batch_size: { min: 1, max: 512, step: 1 },
  chunk_size_tokens: { min: 50, max: 1500, step: 10 },
  chunk_overlap_tokens: { min: 0, max: 0, step: 5 }, // max is dynamic: chunk_size - 1
  git_history_in_months: { min: 1, max: 240, step: 1 },
  top_k: { min: 1, max: 200, step: 1 },
  rrf_k: { min: 1, max: 200, step: 1 },
  vector_weight: { min: 0, max: 1, step: 0.05 },
  fts_weight: { min: 0, max: 1, step: 0.05 },
  auto_reindex_interval_minutes: { min: 1, max: 10080, step: 1 },
};

/** Effective bounds for a key; chunk overlap's max tracks the current chunk size. */
function boundsFor(key: keyof typeof STATIC_BOUNDS, chunkSize: number): NumBounds {
  const b = STATIC_BOUNDS[key];
  return key === "chunk_overlap_tokens"
    ? { ...b, max: Math.max(b.min, chunkSize - 1) }
    : b;
}

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
  min?: number;
  max?: number;
  step?: number;
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
        min={props.min}
        max={props.max}
        step={props.step}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        class="h-8 w-24 rounded-control border border-line bg-paper px-2 text-right text-[13px] outline-none focus:border-leaf"
      />
    </div>
  );
}

/* Decimal blend controls (e.g. the search weights) are a draggable progress
   bar from 0 to 1 instead of a number box — the .slider class paints the
   filled portion from the --fill custom property, and the tiny readout keeps
   the exact value visible since a 0.05 step is hard to eyeball. */
function RangeField(props: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const uid = createUniqueId();
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const pct = () => ((props.value - min) / (max - min)) * 100;
  return (
    <div class="flex items-center justify-between gap-4">
      <span class="flex items-center gap-1.5 text-[13.5px] text-ink-soft">
        <label for={uid} class="cursor-pointer">
          {props.label}
        </label>
        {props.hint && <InfoTip text={props.hint} />}
      </span>
      <span class="flex shrink-0 items-center gap-2.5">
        <input
          id={uid}
          type="range"
          value={props.value}
          min={min}
          max={max}
          step={props.step}
          onInput={(e) => props.onChange(Number(e.currentTarget.value))}
          class="slider w-40"
          style={{ "--fill": `${pct()}%` } as JSX.CSSProperties}
        />
        <span class="data w-9 shrink-0 text-right text-muted tabular-nums">
          {props.value.toFixed(2)}
        </span>
      </span>
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

/** Clamp a freshly loaded config into the hard bounds so out-of-range values
    saved by an older version or a hand-edited file get corrected on open. */
const sanitizeConfig = (cfg: AppConfig): AppConfig => {
  cfg.embedding_batch_size = clamp(
    cfg.embedding_batch_size,
    STATIC_BOUNDS.embedding_batch_size.min,
    STATIC_BOUNDS.embedding_batch_size.max,
  );
  cfg.chunk_size_tokens = clamp(
    cfg.chunk_size_tokens,
    STATIC_BOUNDS.chunk_size_tokens.min,
    STATIC_BOUNDS.chunk_size_tokens.max,
  );
  cfg.chunk_overlap_tokens = clamp(
    cfg.chunk_overlap_tokens,
    STATIC_BOUNDS.chunk_overlap_tokens.min,
    Math.max(STATIC_BOUNDS.chunk_overlap_tokens.min, cfg.chunk_size_tokens - 1),
  );
  cfg.git_history_in_months = clamp(
    cfg.git_history_in_months,
    STATIC_BOUNDS.git_history_in_months.min,
    STATIC_BOUNDS.git_history_in_months.max,
  );
  cfg.search_defaults.top_k = clamp(cfg.search_defaults.top_k, STATIC_BOUNDS.top_k.min, STATIC_BOUNDS.top_k.max);
  cfg.search_defaults.rrf_k = clamp(cfg.search_defaults.rrf_k, STATIC_BOUNDS.rrf_k.min, STATIC_BOUNDS.rrf_k.max);
  cfg.search_defaults.vector_weight = clamp(
    cfg.search_defaults.vector_weight,
    STATIC_BOUNDS.vector_weight.min,
    STATIC_BOUNDS.vector_weight.max,
  );
  cfg.search_defaults.fts_weight = clamp(
    cfg.search_defaults.fts_weight,
    STATIC_BOUNDS.fts_weight.min,
    STATIC_BOUNDS.fts_weight.max,
  );
  cfg.gui.auto_reindex_interval_minutes = clamp(
    cfg.gui.auto_reindex_interval_minutes,
    STATIC_BOUNDS.auto_reindex_interval_minutes.min,
    STATIC_BOUNDS.auto_reindex_interval_minutes.max,
  );
  return cfg;
};

export function SettingsView() {
  const store = useAppStore();
  const [draft, setDraft] = createSignal<AppConfig | null>(null);

  // Initialize the draft once from the loaded config, clamping any out-of-range
  // values a hand-edited config.json may have carried.
  createEffect(() => {
    const c = store.config();
    if (c && !draft()) setDraft(sanitizeConfig(cloneCfg(c)));
  });

  const setNumber = (
    k: "embedding_batch_size" | "chunk_size_tokens" | "chunk_overlap_tokens" | "git_history_in_months",
    n: number,
  ) =>
    setDraft((d) => {
      if (!d) return d;
      if (k === "chunk_size_tokens") {
        // Shrinking the chunk size must pull overlap back below it.
        const size = clamp(n, STATIC_BOUNDS.chunk_size_tokens.min, STATIC_BOUNDS.chunk_size_tokens.max);
        const overlap = clamp(
          d.chunk_overlap_tokens,
          STATIC_BOUNDS.chunk_overlap_tokens.min,
          Math.max(STATIC_BOUNDS.chunk_overlap_tokens.min, size - 1),
        );
        return { ...d, chunk_size_tokens: size, chunk_overlap_tokens: overlap };
      }
      const b = boundsFor(k, d.chunk_size_tokens);
      return { ...d, [k]: clamp(n, b.min, b.max) };
    });

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
    setDraft((d) => {
      if (!d) return d;
      const b = STATIC_BOUNDS[k];
      return { ...d, search_defaults: { ...d.search_defaults, [k]: clamp(n, b.min, b.max) } };
    });
  const setGui = (p: Partial<GUIConfig>) =>
    setDraft((d) => {
      if (!d) return d;
      const gui = { ...d.gui, ...p };
      if (p.auto_reindex_interval_minutes !== undefined) {
        const b = STATIC_BOUNDS.auto_reindex_interval_minutes;
        gui.auto_reindex_interval_minutes = clamp(p.auto_reindex_interval_minutes, b.min, b.max);
      }
      return { ...d, gui };
    });

  const save = async () => {
    const d = draft();
    if (d) await store.saveConfig(d);
  };

  /* ---- Model library (independent of the config draft) ---- */

  // The active model from the backend's installed-models list.
  const activeModel = (): ModelInfo | null => store.models().find((m) => m.isActive) ?? null;

  // Per-model settings form for the active model.
  const [modelCtx, setModelCtx] = createSignal(0);
  const [modelBatch, setModelBatch] = createSignal(32);
  const [modelThreads, setModelThreads] = createSignal(0);
  createEffect(() => {
    const m = activeModel();
    if (m) {
      setModelCtx(m.contextWindow);
      setModelBatch(m.batchSize);
      setModelThreads(m.threads);
    }
  });

  // Pending dimension-change switch, awaiting the destructive-confirm dialog.
  const [confirmDim, setConfirmDim] = createSignal<{ path: string; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = createSignal(false);

  const modelLabel = (m: ModelInfo) => (m.dimensions > 0 ? `${m.name} · ${m.dimensions}d` : m.name);

  const switchModel = async (path: string) => {
    if (path === activeModel()?.path) return;
    const r = await store.setActiveModel(path);
    if (r.needsRebuild) setConfirmDim({ path, name: r.name });
  };

  const confirmDimSwitch = async () => {
    const c = confirmDim();
    if (!c) return;
    setConfirmBusy(true);
    try {
      await store.setActiveModel(c.path, true);
      setConfirmDim(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const importModelFlow = async () => {
    const p = await pickModelFile();
    if (!p) return;
    try {
      const m = await importModel(p);
      await store.loadModels();
      store.pushToast(`Imported ${m.name}`, "success");
    } catch (err) {
      store.pushToast(`Import failed: ${err}`, "danger");
    }
  };

  const removeModel = async (m: ModelInfo) => {
    await store.deleteModel(m.path, m.name);
  };

  const saveModelSettings = async () => {
    const m = activeModel();
    if (!m) return;
    await store.updateModelSettings(m.id, modelCtx(), modelBatch(), modelThreads());
  };

  return (
    <div class="relative flex h-full flex-col">
      <ViewHeading title="Settings" note="Model, chunking, search, and sources. Everything stays on this machine.">
        <Button onClick={() => void save()}>Save settings</Button>
      </ViewHeading>

      <Show when={draft()} fallback={<p class="note text-muted">Loading settings…</p>}>
        <div class="scroll-quiet -mr-2 flex-1 overflow-y-auto pr-2">
          <Section
            title="Model"
            note="The embedding engine runs in-process. Import a .gguf below, or drop one into the models folder of the vectile data directory — it shows up here automatically."
          >
            <div class="flex flex-wrap items-center gap-3">
              <StatusPill state={store.modelState()} name={store.modelName()} />
            </div>
            <div class="data truncate text-muted" title={store.status()?.modelPath ?? ""}>
              {store.status()?.modelPath ?? "…"}
            </div>

            <div class="flex items-center justify-between gap-4">
              <span class="text-[13.5px] text-ink-soft">Active model</span>
              <Select
                aria-label="Active model"
                value={activeModel()?.path ?? ""}
                options={store.models().map((m) => ({ value: m.path, label: modelLabel(m) }))}
                onChange={(e) => void switchModel(e.currentTarget.value)}
              />
            </div>

            <div class="flex items-center justify-between gap-4">
              <span class="text-[13.5px] text-ink-soft">Add a model file</span>
              <Button size="sm" onClick={() => void importModelFlow()}>
                Import model…
              </Button>
            </div>

            <Show when={activeModel()}>
              {(m) => (
                <div class="rounded-control border border-line bg-surface/40 p-3">
                  <p class="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                    {m().name} settings
                    <InfoTip text="Each model carries its own settings. Context 0 and threads 0 mean the defaults (2048 tokens, all cores)." />
                  </p>
                  <div class="data mb-2 truncate text-muted">
                    Dimensions: {m().dimensions > 0 ? m().dimensions : "auto"}
                  </div>
                  <NumField
                    label="Context window (tokens)"
                    value={modelCtx()}
                    onChange={setModelCtx}
                    hint="How many tokens the model can read at once. 0 = the default (2048). Raise it for long chunks, lower it to save memory."
                    min={0}
                    max={8192}
                    step={256}
                  />
                  <NumField
                    label="Embedding batch size"
                    value={modelBatch()}
                    onChange={setModelBatch}
                    hint="How many chunks get fed to the model at once. A bigger number finishes indexing faster but uses more memory while it runs. If a large library makes the app stall, drop it to something like 16."
                    min={STATIC_BOUNDS.embedding_batch_size.min}
                    max={STATIC_BOUNDS.embedding_batch_size.max}
                    step={STATIC_BOUNDS.embedding_batch_size.step}
                  />
                  <NumField
                    label="CPU threads"
                    value={modelThreads()}
                    onChange={setModelThreads}
                    hint="0 = use all cores. Lower it if indexing starves the rest of the system."
                    min={0}
                    max={64}
                    step={1}
                  />
                  <div class="mt-2 flex justify-end">
                    <Button size="sm" onClick={() => void saveModelSettings()}>
                      Save model settings
                    </Button>
                  </div>
                </div>
              )}
            </Show>

            <Show when={store.models().length > 0}>
              <p class="mb-1 text-[13px] font-medium text-ink-soft">Installed models</p>
              <ul class="space-y-1">
                <For each={store.models()}>
                  {(m) => (
                    <li class="flex items-center gap-2 rounded-control border border-line bg-paper px-3 py-1.5">
                      <span class="data flex-1 truncate text-muted" title={m.path}>
                        {modelLabel(m)}
                      </span>
                      {m.isActive && (
                        <span class="shrink-0 rounded-control bg-mint px-1.5 py-0.5 text-[11px] font-medium text-leaf-deep">
                          active
                        </span>
                      )}
                      <button
                        class="shrink-0 text-faint transition-colors hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={`Remove ${m.name}`}
                        disabled={m.isActive}
                        onClick={() => void removeModel(m)}
                      >
                        <CloseIcon size={14} />
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <Show when={store.models().length === 0}>
              <p class="note text-muted">
                No models yet. Import a .gguf or drop one into the models folder.
              </p>
            </Show>

            <ConfirmDialog
              open={confirmDim() !== null}
              title="Switching changes the embedding dimension"
              body={
                <>
                  <p>
                    <span class="font-medium text-ink">{confirmDim()?.name}</span> uses a
                    different embedding dimension than the current model. Every indexed
                    collection will need to be re-indexed before meaning-search works again,
                    and all existing embeddings will be cleared.
                  </p>
                  <p class="mt-2">Switch anyway?</p>
                </>
              }
              confirmLabel="Switch & re-index"
              busy={confirmBusy()}
              onCancel={() => setConfirmDim(null)}
              onConfirm={() => void confirmDimSwitch()}
            />
          </Section>

          <Section title="Chunking" note="Word-based windows. Smaller chunks match tighter; overlap keeps straddling sentences intact.">
            <NumField
              label="Chunk size (words)"
              value={draft()!.chunk_size_tokens}
              onChange={(n) => setNumber("chunk_size_tokens", n)}
              hint="How many words each indexed slice of a document holds. Search matches against these slices, not whole files, so this sets how finely results are cut. Small chunks answer narrowly, big ones carry more surrounding context. 500 is a safe starting point."
              min={STATIC_BOUNDS.chunk_size_tokens.min}
              max={STATIC_BOUNDS.chunk_size_tokens.max}
              step={STATIC_BOUNDS.chunk_size_tokens.step}
            />
            <NumField
              label="Chunk overlap (words)"
              value={draft()!.chunk_overlap_tokens}
              onChange={(n) => setNumber("chunk_overlap_tokens", n)}
              hint="How many words repeat from one slice into the next. The repeat keeps sentences and ideas that straddle a cut from being split in half, so they still search whole. Too little overlap and things slip through; too much and the same text gets stored twice. 50 is the usual starting point."
              min={STATIC_BOUNDS.chunk_overlap_tokens.min}
              max={Math.max(STATIC_BOUNDS.chunk_overlap_tokens.min, draft()!.chunk_size_tokens - 1)}
              step={STATIC_BOUNDS.chunk_overlap_tokens.step}
            />
          </Section>

          <Section title="Search" note="Hybrid ranking blends exact-term and meaning results.">
            <NumField
              label="Top results"
              value={draft()!.search_defaults.top_k}
              onChange={(n) => setSearch("top_k", n)}
              hint="How many matches a search returns by default. Raise it to see more of the pile, lower it to keep the list short. You can still ask for a different number on any individual search."
              min={STATIC_BOUNDS.top_k.min}
              max={STATIC_BOUNDS.top_k.max}
              step={STATIC_BOUNDS.top_k.step}
            />
            <NumField
              label="RRF constant (k)"
              value={draft()!.search_defaults.rrf_k}
              onChange={(n) => setSearch("rrf_k", n)}
              hint="A smoothing value in the math that merges the two search lists. Bigger k flattens the gap between high and low ranked matches, so entries further down the list still get a fair shot. 60 is the standard value for this kind of search."
              min={STATIC_BOUNDS.rrf_k.min}
              max={STATIC_BOUNDS.rrf_k.max}
              step={STATIC_BOUNDS.rrf_k.step}
            />
            <RangeField
              label="Vector weight"
              value={draft()!.search_defaults.vector_weight}
              onChange={(n) => setSearch("vector_weight", n)}
              hint="How much the meaning-based ranking counts when the two search lists are blended. It works against the full-text weight like a seesaw: raise it and results lean toward semantic matches, even when the words don't line up exactly."
              min={STATIC_BOUNDS.vector_weight.min}
              max={STATIC_BOUNDS.vector_weight.max}
              step={STATIC_BOUNDS.vector_weight.step}
            />
            <RangeField
              label="Full-text weight"
              value={draft()!.search_defaults.fts_weight}
              onChange={(n) => setSearch("fts_weight", n)}
              hint="How much exact-word matches count in the final blend. Raise it when you're hunting a precise phrase or a name and want literal hits to win. Lower it and meaning takes over from wording."
              min={STATIC_BOUNDS.fts_weight.min}
              max={STATIC_BOUNDS.fts_weight.max}
              step={STATIC_BOUNDS.fts_weight.step}
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
              min={STATIC_BOUNDS.git_history_in_months.min}
              max={STATIC_BOUNDS.git_history_in_months.max}
              step={STATIC_BOUNDS.git_history_in_months.step}
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
                min={STATIC_BOUNDS.auto_reindex_interval_minutes.min}
                max={STATIC_BOUNDS.auto_reindex_interval_minutes.max}
                step={STATIC_BOUNDS.auto_reindex_interval_minutes.step}
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
