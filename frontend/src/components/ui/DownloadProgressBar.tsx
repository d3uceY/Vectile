import { Show } from "solid-js";
import { fmtBytes } from "../../lib/format";
import type { ModelDownloadProgress } from "../../lib/types";
import { ProgressBar } from "./ProgressBar";

/**
 * Determinate download bar driven by model:download-progress events. Reuses
 * the shared ProgressBar: the fill holds at 96% until the backend finishes
 * (rename + register), and a "Preparing…" state shows when the total isn't
 * known yet.
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
    <ProgressBar label="Downloading model" percent={pct()} preparing={preparing()} onCancel={props.onCancel}>
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
    </ProgressBar>
  );
}
