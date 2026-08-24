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
    <aside class="flex w-56 shrink-0 flex-col border-r border-line bg-paper/80">
      {/* Wordmark */}
      <div class="px-5 pb-5 pt-6">
        <div class="flex items-center gap-1.5">
          <span class="text-[19px] font-bold leading-none tracking-[-0.02em] text-ink">
            vectile
          </span>
          <span class="mb-1 h-1.5 w-1.5 rounded-full bg-leaf" aria-hidden="true" />
        </div>
        <p class="note mt-2 text-[13px] leading-5 text-muted">your private library</p>
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
                    class={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.75 text-left text-[13.5px] font-medium transition-colors duration-150 ease-snappy ${
                      active()
                        ? "bg-mint text-leaf-deep"
                        : "text-ink-soft hover:bg-surface hover:text-ink"
                    }`}
                    aria-current={active() ? "page" : undefined}
                    onClick={() => store.setView(item.id)}
                  >
                    <span class={active() ? "text-leaf" : "text-faint group-hover:text-ink-soft"}>
                      <Icon size={17} />
                    </span>
                    {item.label}
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

      {/* Footer: model engine state */}
      <div class="border-t border-line px-5 py-4">
        <StatusPill state={store.modelState()} name={store.modelName()} />
      </div>
    </aside>
  );
}
