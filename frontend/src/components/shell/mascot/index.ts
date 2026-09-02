/** Public entry point for the modular sidebar mascot. */
export { Mascot } from "./Mascot";
export type { MascotState, ActiveMascotState } from "./types";
export {
  MASCOT_HOLD_MS,
  MASCOT_EXIT_MS,
  MASCOT_SEARCH_HOLD_MS,
  MASCOT_TIMINGS,
  getMascotTiming,
  type MascotTiming,
} from "./lifecycle";
