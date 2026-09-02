import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { ActiveMascotState } from "./types";

/** Per-state show/linger/exit durations for a mascot state. */
export interface MascotTiming {
  /** How long (ms) the mascot lingers after an interaction ends before it
      starts animating back down. */
  hold: number;
  /** Duration (ms) of the exit animation. Keep in sync with `mascot.css`. */
  exit: number;
}

/** Default how long (ms) the mascot lingers after an interaction ends before
    it starts animating back down. */
export const MASCOT_HOLD_MS = 700;

/** Default duration (ms) of the exit animation. Keep in sync with `mascot.css`. */
export const MASCOT_EXIT_MS = 260;

/** The search mascot lingers a touch longer so its "no results" beat stays on
    screen. */
export const MASCOT_SEARCH_HOLD_MS = 1100;

/** Per-state timing overrides. States not listed fall back to the defaults. */
export const MASCOT_TIMINGS: Partial<Record<ActiveMascotState, MascotTiming>> = {
  searching: { hold: MASCOT_SEARCH_HOLD_MS, exit: MASCOT_EXIT_MS },
};

/** Resolve the timing to use for a given mascot state, falling back to the
    module defaults for states without an override. */
export function getMascotTiming(state: ActiveMascotState): MascotTiming {
  return MASCOT_TIMINGS[state] ?? { hold: MASCOT_HOLD_MS, exit: MASCOT_EXIT_MS };
}

export interface MascotVisibility {
  /** The state to render, or `null` when the dino should be hidden. */
  shown: Accessor<ActiveMascotState | null>;
  /** Whether the dino is currently playing its exit animation. */
  leaving: Accessor<boolean>;
}

/** Drives the mascot's show/linger/exit timing.
    - A state goes active → the dino pops straight in.
    - The state clears → it holds for that state's `hold`, then plays the exit
      animation (that state's `exit`) and unmounts.
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
    // Use the shown state's own timing so each mascot lingers as configured.
    if (current && !leaving()) {
      const { hold, exit } = getMascotTiming(current);
      clearTimers();
      holdTimer = setTimeout(() => {
        setLeaving(true);
        exitTimer = setTimeout(() => setShown(null), exit);
      }, hold);
    }
  });

  onCleanup(clearTimers);

  return { shown, leaving };
}
