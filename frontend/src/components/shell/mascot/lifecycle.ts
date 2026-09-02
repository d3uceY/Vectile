import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { ActiveMascotState } from "./types";

/** How long (ms) the mascot lingers after an interaction ends before it starts
    animating back down. */
export const MASCOT_HOLD_MS = 700;

/** Duration (ms) of the exit animation. Keep in sync with `mascot.css`. */
export const MASCOT_EXIT_MS = 260;

export interface MascotVisibility {
  /** The state to render, or `null` when the dino should be hidden. */
  shown: Accessor<ActiveMascotState | null>;
  /** Whether the dino is currently playing its exit animation. */
  leaving: Accessor<boolean>;
}

/** Drives the mascot's show/linger/exit timing.
    - A state goes active → the dino pops straight in.
    - The state clears → it holds for `MASCOT_HOLD_MS`, then plays the exit
      animation (`MASCOT_EXIT_MS`) and unmounts.
    - A new interaction starting mid-exit cancels the pending timers so the new
      state pops in immediately. */
export function useMascotVisibility(raw: Accessor<ActiveMascotState | null>): MascotVisibility {
  const [shown, setShown] = createSignal<ActiveMascotState | null>(null);
  const [leaving, setLeaving] = createSignal(false);

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (holdTimer !== undefined) {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    }
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
      exitTimer = undefined;
    }
  };

  createEffect(() => {
    const next = raw();
    const current = shown();

    if (next) {
      // A live interaction: pop in immediately, cancelling any leaving state.
      clearTimers();
      setLeaving(false);
      if (current !== next) setShown(next);
      return;
    }

    // No active interaction. If the dino is still showing (and not already
    // leaving), give it a moment of quiet, then play the exit and unmount.
    if (current && !leaving()) {
      clearTimers();
      holdTimer = setTimeout(() => {
        setLeaving(true);
        exitTimer = setTimeout(() => setShown(null), MASCOT_EXIT_MS);
      }, MASCOT_HOLD_MS);
    }
  });

  onCleanup(clearTimers);

  return { shown, leaving };
}
