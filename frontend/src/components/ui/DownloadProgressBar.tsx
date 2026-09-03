import { Show } from "solid-js";
import { fmtBytes } from "../../lib/format";
import type { ModelDownloadProgress } from "../../lib/types";

/**
 * Determinate download bar driven by model:download-progress events. Reuses
 * the indexing loader's visuals: the fill holds at 96% until the backend
 * finishes (rename + register), and a "Preparing…" state shows when the total
 * isn't known yet.
 */
export function DownloadProgressBar(props: {
  progress: ModelDownloadProgress;
  onCancel?: () => void;
}) {
  const pct = () => {
    if (props.progress.total <= 0) return 0;
    const raw = (props.progress.downloaded / props.progress.total) * 100;
    return Math.min(96, Math.round(raw * 10) / 10);
  };
  const preparing = () => props.progress.total <= 0;

  return (
    <div
      role="progressbar"
      aria-label="Downloading model"
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
        <Show when={!preparing()}>
          <span class="data shrink-0 text-leaf-deep">{Math.round(pct())}%</span>
          <span class="data truncate text-muted">
            {fmtBytes(props.progress.downloaded)} / {fmtBytes(props.progress.total)}
          </span>
          <Show when={props.progress.speed > 0}>
            <span class="data shrink-0 text-muted">{fmtBytes(props.progress.speed)}/s</span>
          </Show>
        </Show>
        <Show when={preparing()}>
          <span class="data shrink-0 text-muted">Downloading…</span>
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
