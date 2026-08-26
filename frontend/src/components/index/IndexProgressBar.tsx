import { Show } from "solid-js";

/**
 * Inline indexing loader shown on the collection/dir row being indexed.
 *
 * The bar is driven by real per-file events (current/total) but shaped to feel
 * like a "pushing" loader:
 *  - the fill caps at 96%, so it looks like it's about to finish and holds
 *    there while the backend wraps up the last batch; the user waits instead
 *    of expecting an instant 100%;
 *  - the width transition eases from slow to fast (start → accelerate);
 *  - a leaf-green shine sweeps across the fill and a soft glow pulses
 *    underneath, all disabled under prefers-reduced-motion.
 */
export function IndexProgressBar(props: {
  collection: string;
  current: number;
  total: number;
  file?: string;
  onCancel?: () => void;
}) {
  const pct = () => {
    if (props.total <= 0) return 0;
    const raw = (props.current / props.total) * 100;
    return Math.min(96, Math.round(raw * 10) / 10); // hold at 96% until complete
  };

  // total <= 0 means the run just started and hasn't counted its first file
  // yet, so show an indeterminate "Preparing…" state rather than a stalled 0/0.
  const preparing = () => props.total <= 0;

  return (
    <div
      class="index-progress"
      role="progressbar"
      aria-label={`Indexing ${props.collection}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={preparing() ? undefined : Math.round(pct())}
    >
      <div class="index-progress__track">
        <div
          class="index-progress__fill"
          classList={{ "index-progress__fill--preparing": preparing() }}
          style={{ width: preparing() ? "36%" : `${pct()}%` }}
        >
          <span class="index-progress__shine" aria-hidden="true" />
        </div>
      </div>
      <div class="mt-1.5 flex items-center gap-2">
        <span class="data truncate text-faint">{props.file ?? ""}</span>
        <Show when={!preparing()}>
          <span class="data shrink-0 text-leaf-deep">
            {props.current}/{props.total}
          </span>
        </Show>
        <Show when={props.onCancel}>
          <button
            type="button"
            onClick={props.onCancel}
            class="ml-auto inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            Cancel
          </button>
        </Show>
      </div>
    </div>
  );
}
