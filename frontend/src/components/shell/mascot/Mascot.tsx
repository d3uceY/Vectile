import { Show } from "solid-js";
import { useMascotState } from "./state";
import { useMascotVisibility } from "./lifecycle";
import { MASCOT_ASSETS, MASCOT_STATIC } from "./assets";
import "./mascot.css";

/* ------------------------------------------------------------------
   Sidebar mascot: a small pixel dinosaur that pops in from the bottom
   of the footer colophon while an interaction is happening, lingers
   for a beat once it ends, then animates back down. Purely decorative.

   The component just composes the module pieces:
     - useMascotState()      : store -> which interaction is active
     - useMascotVisibility() : show / 700ms hold / exit timing
     - assets.ts             : state -> image URLs
   Nothing renders unless a state is active.
   ------------------------------------------------------------------ */

export function Mascot() {
  const active = useMascotState();
  const { shown, leaving } = useMascotVisibility(active);

  return (
    <div class="mascot-stage" aria-hidden="true">
      {/* keyed Show: a fresh element per state, so the pop-in re-runs each time.
          Two imgs stack: the animated webp wins normally, the static PNG is
          swapped in under prefers-reduced-motion via a CSS media query (the
          browser does not reliably honor a <source media=...> swap here). */}
      <Show when={shown()} keyed>
        {(state) => (
          <div class={`mascot mascot--${state}${leaving() ? " mascot--leaving" : ""}`}>
            <img class="mascot__anim" src={MASCOT_ASSETS[state]} alt="" draggable={false} />
            <img class="mascot__static" src={MASCOT_STATIC} alt="" draggable={false} />
          </div>
        )}
      </Show>
    </div>
  );
}
