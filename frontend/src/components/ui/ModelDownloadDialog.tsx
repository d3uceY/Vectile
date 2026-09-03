import { For, Show } from "solid-js";
import { openExternal } from "../../lib/update";
import { baseName, fmtBytes } from "../../lib/format";
import type { CatalogModel, ModelDownloadState, ModelInfo } from "../../lib/types";
import { Button } from "./primitives";
import { DownloadProgressBar } from "./DownloadProgressBar";

/**
 * Onboarding sheet shown on launch when no embedding model is installed. Offers
 * the curated catalog with an in-app download, or an escape hatch to import a
 * .gguf / browse Hugging Face. Matches the UpdateDialog notebook world.
 */
export function ModelDownloadDialog(props: {
  open: boolean;
  recommended: CatalogModel[];
  downloadState: ModelDownloadState | null;
  installedModels: ModelInfo[];
  onDownload: (key: string) => void;
  onUninstall: (file: string) => void;
  onCancel: () => void;
  onImport: () => void;
  onDismiss: () => void;
}) {
  // A catalog model is installed when an installed model shares its filename.
  const isInstalled = (cat: CatalogModel) =>
    props.installedModels.some((m) => baseName(m.path) === cat.file);
  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Add an embedding model"
        onClick={props.onDismiss}
      >
        <div class="sheet w-104 p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
         
          <h3 class="title mt-2 text-[17px] tracking-[-0.01em] text-ink">Add an embedding model</h3>
          <p class="read mt-2.5 text-[13.5px] leading-5 text-muted">
            Vectile searches by meaning. It needs one of these, or bring your own.
          </p>

          <div class="mt-4 max-h-76 space-y-2 overflow-y-auto pr-1">
            <For each={props.recommended}>
              {(m) => (
                <div class="rounded-control border border-line bg-paper p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        {m.name}
                        <Show when={m.recommended}>
                          <span class="rounded-control bg-mint px-1.5 py-0.5 text-[10.5px] font-medium text-leaf-deep">
                            recommended
                          </span>
                        </Show>
                      </p>
                      <p class="data mt-0.5 text-muted">
                        {m.dimensions} dims · {fmtBytes(m.sizeBytes)} · {m.quantization} · {m.language}
                      </p>
                      <p class="mt-0.5 text-[12.5px] text-faint">{m.description}</p>
                    </div>
                    <Show when={props.downloadState?.key !== m.key}>
                      <Show
                        when={!isInstalled(m)}
                        fallback={
                          <div class="flex items-center gap-2">
                            <span class="rounded-control bg-mint px-1.5 py-0.5 text-[10.5px] font-medium text-leaf-deep">
                              installed
                            </span>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => props.onUninstall(m.file)}
                            >
                              Uninstall
                            </Button>
                          </div>
                        }
                      >
                        <Button size="sm" onClick={() => props.onDownload(m.key)}>
                          Download
                        </Button>
                      </Show>
                    </Show>
                  </div>
                  <Show when={props.downloadState?.key === m.key}>
                    <div class="mt-2">
                      <DownloadProgressBar
                        progress={{
                          key: m.key,
                          downloaded: props.downloadState!.downloaded,
                          total: props.downloadState!.total,
                          percent: props.downloadState!.percent,
                          speed: props.downloadState!.speed,
                        }}
                        onCancel={props.onCancel}
                      />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={props.onImport}>
              Import my own .gguf
            </Button>
            <div class="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExternal("https://huggingface.co/models?search=embedding")}
              >
                Browse Hugging Face
              </Button>
              <Button size="sm" variant="outline" onClick={props.onDismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
