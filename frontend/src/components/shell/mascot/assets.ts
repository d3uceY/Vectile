import type { ActiveMascotState } from "./types";

export const MASCOT_ASSETS: Record<ActiveMascotState, string> = {
  searching: "/vectile-mascot-search.webp",
  indexing: "/vectile-mascot-indexing-alt.webp",
  nothing: "/vectile-mascot-nothing.webp",
};

/** Shared static frame used as the fallback and under `prefers-reduced-motion`
    (no looping motion for motion-sensitive users). */
export const MASCOT_STATIC = "/vectile-mascot.png";
