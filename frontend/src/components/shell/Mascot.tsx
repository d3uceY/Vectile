import { createMemo, Show } from "solid-js";
import { useAppStore } from "../../lib/store";

/* ------------------------------------------------------------------
   Sidebar mascot: a small pixel dinosaur that pops in from the bottom
   of the footer colophon only while an interaction is happening, then
   gets out of the way when things go quiet. Purely decorative, driven
   entirely by store state. Nothing shows unless a state is active.

   The state -> asset map is the one place to add a new interaction:
   drop a key here and in the store-derived memo below.
   ------------------------------------------------------------------ */

export type MascotState = "hidden" | "searching" | "indexing" | "nothing";

// One animated webp per active state. The static PNG is the fallback frame
// and the prefers-reduced-motion substitute (no looping motion for those users).
const MASCOT_ASSETS: Record<Exclude<MascotState, "hidden">, string> = {
  searching: "/vectile-mascot-idle.webp",
  indexing: "/vectile-mascot-indexing.webp",
  nothing: "/vectile-mascot-nothing.webp",
};

const MASCOT_STATIC = "/vectile-mascot.png";

export function Mascot() {
  const store = useAppStore();

  // Priority order: a background index run is the longest-lived and loudest
  // signal, so it wins. Searching and "no results" only make sense while the
  // Search view is on screen. No active state = hidden.
  const active = createMemo<Exclude<MascotState, "hidden"> | null>(() => {
    if (store.indexing() || store.indexProgress() !== null) return "indexing";
    if (store.view() === "search") {
      if (store.searchState() === "searching") return "searching";
      if (store.searchState() === "done" && store.results().length === 0) return "nothing";
    }
    return null;
  });

  return (
    <div class="mascot-stage" aria-hidden="true">
      {/* keyed Show: a fresh element per state, so the pop-in re-runs each time.
          Two imgs stack: the animated webp wins normally, the static PNG is
          swapped in under prefers-reduced-motion via a CSS media query (the
          browser does not reliably honor a <source media=...> swap here). */}
      <Show when={active()} keyed>
        {(state) => (
          <div class={`mascot mascot--${state}`}>
            <img class="mascot__anim" src={MASCOT_ASSETS[state]} alt="" draggable={false} />
            <img class="mascot__static" src={MASCOT_STATIC} alt="" draggable={false} />
          </div>
        )}
      </Show>
    </div>
  );
}
