import { For, type JSX } from "solid-js";
import { useAppStore } from "../../lib/store";
import type { ViewId } from "../../lib/types";
import {
  BrowseIcon,
  IndexIcon,
  LibraryIcon,
  SearchIcon,
  SettingsIcon,
} from "../ui/icons";
import { StatusPill } from "../ui/primitives";

const NAV: { id: ViewId; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "browse", label: "Browse", icon: BrowseIcon },
  { id: "index", label: "Index", icon: IndexIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const store = useAppStore();
  return (
    /* Full sidebar with labels at md+; collapses to an icon rail below so a
       narrow window still leaves room for the content column. */
    <aside class="flex w-16 shrink-0 flex-col border-r border-line bg-paper/80 md:w-56">
      {/* Wordmark */}
      <div class="flex flex-col items-center gap-1 pb-5 pt-6 md:block md:px-5">
        <div class="flex items-center justify-center gap-2 md:justify-start">
          <img
            src="/vectile-logo.png"
            alt="vectile"
            class="h-5 w-5 shrink-0 rounded-[5px]"
          />
          <span class="hidden text-[19px] font-bold leading-none tracking-[-0.02em] text-ink md:inline">
            vectile
          </span>
        </div>
        <p class="note mt-2 hidden text-[13px] leading-5 text-muted md:block">your private library</p>
      </div>

      {/* Nav */}
      <nav class="flex-1 px-3" aria-label="Primary">
        <ul class="space-y-0.5">
          <For each={NAV}>
            {(item) => {
              const active = () => store.view() === item.id;
              const Icon = item.icon;
              return (
                <li>
                  <button
                    class={`group relative flex w-full items-center justify-center gap-3 rounded-lg px-0 py-1.75 text-left text-[13.5px] font-medium transition-colors duration-150 ease-snappy md:justify-start md:px-3 ${
                      active()
                        ? "bg-mint text-leaf-deep"
                        : "text-ink-soft hover:bg-surface hover:text-ink"
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
                    {active() && (
                      <span
                        class="absolute left-0 top-1/2 h-4 w-0.75 -translate-y-1/2 rounded-full bg-leaf"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </nav>

      {/* Footer: model engine state — dot only in the icon rail */}
      <div class="border-t border-line py-4 md:px-5">
        <div class="flex justify-center md:justify-start">
          <span class="md:hidden">
            <StatusPill compact state={store.modelState()} name={store.modelName()} />
          </span>
          <span class="hidden md:block">
            <StatusPill state={store.modelState()} name={store.modelName()} />
          </span>
        </div>
      </div>
    </aside>
  );
}
