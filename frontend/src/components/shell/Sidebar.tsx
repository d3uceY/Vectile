import { For, type JSX } from "solid-js";
import { useAppStore } from "../../lib/store";
import type { ModelState, ViewId } from "../../lib/types";
import {
  BrowseIcon,
  IndexIcon,
  LibraryIcon,
  SearchIcon,
  SettingsIcon,
} from "../ui/icons";
import { Mascot } from "./mascot";

/* ------------------------------------------------------------------
   Sidebar: the notebook's index tabs. The active view is a filing-
   cabinet tab pulled out over the spine, a mint square-cornered tab
   that pokes 5px past the hairline border. The footer holds a cardstock
   plate with the model state, the model name, and a local-first note.
   ------------------------------------------------------------------ */

const NAV: { id: ViewId; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "browse", label: "Browse", icon: BrowseIcon },
  { id: "index", label: "Index", icon: IndexIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const modelCopy: Record<ModelState, { label: string; dot: string; text: string }> = {
  loaded: { label: "loaded", dot: "bg-leaf", text: "text-leaf-deep" },
  idle: { label: "idle", dot: "bg-faint", text: "text-muted" },
  failed: { label: "failed", dot: "bg-danger", text: "text-danger" },
};

/** The engine's colophon: one quiet line in the sidebar footer, left-aligned
    to match the nav. A colored dot + state word, the model id in mono, and a
    muted "local" tag. Long model names truncate instead of blowing out. */
function ModelPlate(props: { state: ModelState; name?: string }) {
  const m = () => modelCopy[props.state];
  const tip = () => (props.name ? `${m().label} · ${props.name}` : m().label);
  return (
    <span class="flex min-w-0 items-center gap-2" title={tip()}>
      <span class="relative flex h-2 w-2 shrink-0">
        <span class={`h-2 w-2 rounded-full ${m().dot} ${props.state === "loaded" ? "pulse-dot" : ""}`} />
      </span>
      <span class={`data shrink-0 transition-colors ${m().text}`}>{m().label}</span>
      <span class="data min-w-0 truncate text-muted">{props.name ?? "…"}</span>
      <span class="data shrink-0 text-muted">local</span>
    </span>
  );
}

export function Sidebar() {
  const store = useAppStore();
  return (
    /* Full sidebar with labels at md+; collapses to an icon rail below so a
       narrow window still leaves room for the content column. */
    <aside class="flex w-16 shrink-0 flex-col border-r border-line bg-sidebar md:w-56">
      {/* Title plate */}
      <div class="flex flex-col items-center gap-2.5 pb-4 pt-6 md:block md:px-5">
        <div class="flex items-center justify-center gap-3 md:justify-start">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-line bg-paper shadow-[0_1px_1px_rgb(27_34_38/0.05)]">
            <img src="/vectile-logo.png" alt="vectile" class="h-6 w-6" />
          </span>
          <span class="hidden font-serif text-[20px] font-medium leading-none tracking-[-0.015em] text-ink md:inline">
            vectile
          </span>
        </div>
        <p class="note hidden text-[12.5px] leading-4 text-muted md:block">your private library</p>
      </div>
      <div class="mx-5 hidden border-t border-line md:block" aria-hidden="true" />

      {/* Index tabs */}
      <nav class="flex-1 px-3 pt-3" aria-label="Primary">
        <ul class="space-y-0.5">
          <For each={NAV}>
            {(item) => {
              const active = () => store.view() === item.id;
              const Icon = item.icon;
              return (
                <li>
                  <button
                    class={`group relative flex w-full items-center justify-center gap-3 rounded-l-[9px] py-2 text-[13.5px] font-medium transition-colors duration-150 ease-snappy md:justify-start md:px-3 ${
                      active()
                        ? "-mr-4.25 bg-mint-strong text-leaf-deep"
                        : "text-ink-soft hover:bg-mint-strong hover:text-ink"
                    }`}
                    aria-current={active() ? "page" : undefined}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => store.setView(item.id)}
                  >
                    <span class={active() ? "text-leaf" : "text-faint group-hover:text-ink-soft"}>
                      <Icon size={17} />
                    </span>
                    <span class="hidden md:inline">{item.label}</span>
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </nav>

      {/* Engine colophon */}
      <footer class="relative shrink-0 border-t border-line px-4 pb-4 pt-3 md:px-5">
        {/* Mascot: rises from the footer's top edge into the idle nav space, only
            while an interaction runs. Absolute + pointer-events-none so it never
            reserves space and never nudges the colophon below. Hidden on the
            icon rail (too narrow for the dino). */}
        <div class="pointer-events-none absolute inset-x-0 bottom-full hidden justify-center md:flex">
          <Mascot />
        </div>
        {/* Icon rail (< md): just the state dot, no room for text */}
        <div class="flex justify-center md:hidden">
          <span class="relative flex h-2 w-2 shrink-0">
            <span
              class={`h-2 w-2 rounded-full ${modelCopy[store.modelState()].dot} ${
                store.modelState() === "loaded" ? "pulse-dot" : ""
              }`}
            />
          </span>
        </div>
        <div class="hidden md:block">
          <ModelPlate state={store.modelState()} name={store.modelName()} />
        </div>
      </footer>
    </aside>
  );
}
