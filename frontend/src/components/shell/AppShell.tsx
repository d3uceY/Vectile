import { onCleanup, onMount, Show } from "solid-js";
import { useAppStore } from "../../lib/store";
import { DotPattern } from "../ui/patterns";
import { ToastStack } from "../ui/primitives";
import { Sidebar } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { SearchView } from "../search/SearchView";
import { LibraryView } from "../library/LibraryView";
import { BrowseView } from "../library/BrowseView";
import { PlaceholderView } from "./PlaceholderView";

export function AppShell() {
  const store = useAppStore();

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        store.focusSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div class="relative flex h-full overflow-hidden bg-paper text-ink">
      {/* Graph-paper ground, faint, behind everything */}
      <div class="pointer-events-none absolute inset-0 text-ink/[0.055]">
        <DotPattern width={20} height={20} cx={1} cy={1} cr={1} />
      </div>

      <Sidebar />

      <div class="relative flex min-w-0 flex-1 flex-col">
        <StatusStrip />
        <main class="scroll-quiet relative flex-1 overflow-y-auto">
          <div class="relative mx-auto h-full w-full max-w-[61.25rem] px-5 py-7 md:px-8">
            <Show when={store.view() === "search"}>
              <SearchView />
            </Show>
            <Show when={store.view() === "library"}>
              <LibraryView />
            </Show>
            <Show when={store.view() === "browse"}>
              <BrowseView />
            </Show>
            <Show when={store.view() === "index"}>
              <PlaceholderView
                view="index"
                title="Index"
                note="Adding sources and watching them index ships in the next slice. For now the library you see was indexed the usual way: incrementally, nothing re-embedded twice."
              />
            </Show>
            <Show when={store.view() === "settings"}>
              <PlaceholderView
                view="settings"
                title="Settings"
                note="Model, chunking, and search defaults land with the backend. What you can change today: nothing, which is a feature until it isn't."
              />
            </Show>
          </div>
        </main>
      </div>

      <ToastStack toasts={store.toasts()} onDismiss={(id) => store.dismissToast(id)} />
    </div>
  );
}
