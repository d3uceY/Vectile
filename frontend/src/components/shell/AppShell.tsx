import { createSignal, onCleanup, onMount, Show } from "solid-js";
import * as api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { fetchLatestRelease, isDesktop, isNewer } from "../../lib/update";
import { DotPattern } from "../ui/patterns";
import { ToastStack } from "../ui/primitives";
import { UpdateDialog } from "../ui/UpdateDialog";
import { Sidebar } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { SearchView } from "../search/SearchView";
import { LibraryView } from "../library/LibraryView";
import { BrowseView } from "../library/BrowseView";
import { IndexView } from "../index/IndexView";
import { SettingsView } from "../settings/SettingsView";

export function AppShell() {
  const store = useAppStore();
  const [version, setVersion] = createSignal<string | null>(null);
  const [updateInfo, setUpdateInfo] = createSignal<{ latest: string; current: string } | null>(null);

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

  // Version + update check: once per launch, desktop only, stable releases
  // only (a beta/rc latest release never triggers the dialog; see isNewer).
  onMount(() => {
    void (async () => {
      const v = await api.getVersion().catch(() => null);
      if (!v) return;
      setVersion(v);
      if (!isDesktop) return;
      const latest = await fetchLatestRelease();
      if (latest && isNewer(latest, v)) setUpdateInfo({ latest, current: v });
    })();
  });

  return (
    <div class="relative flex h-full overflow-hidden bg-paper text-ink">
      {/* Graph-paper ground: visible but quiet, behind everything */}
      <div class="pointer-events-none absolute inset-0 text-ink/10">
        <DotPattern width={20} height={20} cx={1} cy={1} cr={1.25} />
      </div>

      <Sidebar />

      <div class="relative flex min-w-0 flex-1 flex-col">
        <StatusStrip version={version() ?? undefined} />
        {/* One non-scrolling frame; each view owns its scroll (per-view scroll) */}
        <main class="relative min-h-0 flex-1 overflow-hidden">
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
              <IndexView />
            </Show>
            <Show when={store.view() === "settings"}>
              <SettingsView />
            </Show>
          </div>
        </main>
      </div>

      <UpdateDialog
        open={updateInfo() !== null}
        latest={updateInfo()?.latest ?? ""}
        current={updateInfo()?.current ?? ""}
        onDismiss={() => setUpdateInfo(null)}
      />

      <ToastStack toasts={store.toasts()} onDismiss={(id) => store.dismissToast(id)} />
    </div>
  );
}
