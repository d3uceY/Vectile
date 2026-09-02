import type { ActiveMascotState } from "./types";

export const MASCOT_ASSETS: Record<ActiveMascotState, string> = {
  searching: "/vectile-mascot-idle.webp",
  indexing: "/vectile-mascot-indexing.webp",
  nothing: "/vectile-mascot-nothing.webp",
};

/** Shared static frame used as the fallback and under `prefers-reduced-motion`
    (no looping motion for motion-sensitive users). */
export const MASCOT_STATIC = "/vectile-mascot.png";
