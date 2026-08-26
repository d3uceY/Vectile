/* Typed wrapper around the generated Wails bindings. Components only talk to
   this module, never to the raw bindings, so the API surface stays stable
   when bindings are regenerated. */

import { Dialogs } from "@wailsio/runtime";
import * as AppService from "../../bindings/vectile/backend/services/appservice";
import * as IndexService from "../../bindings/vectile/backend/services/indexservice";
import * as ModelService from "../../bindings/vectile/backend/services/modelservice";
import * as SearchService from "../../bindings/vectile/backend/services/searchservice";
import type {
  AppConfig,
  Collection,
  Document,
  IndexState,
  ModelInfo,
  SearchFilters,
  SearchResult,
  SetActiveResult,
  Source,
  Status,
} from "./types";

const filterToBackend = (f: SearchFilters) => ({
  collection: f.collection ?? "",
  sourceType: f.sourceType ?? "",
  path: f.path ?? "",
  dateFrom: f.dateFrom ?? "",
  dateTo: f.dateTo ?? "",
  sender: f.sender ?? "",
  author: f.author ?? "",
  metadataFilters: f.metadataFilters ?? {},
  topK: f.topK,
});

export async function getStatus(): Promise<Status> {
  return AppService.GetStatus() as unknown as Status;
}

export async function getVersion(): Promise<string> {
  return AppService.GetVersion() as unknown as string;
}

/** Number of logical CPUs available; the ceiling for the model's thread slider. */
export async function getCPUCount(): Promise<number> {
  return AppService.GetCPUCount() as unknown as number;
}

export async function listCollections(): Promise<Collection[]> {
  return AppService.ListCollections() as unknown as Collection[];
}

export async function listSources(collectionId: number): Promise<Source[]> {
  return AppService.ListSources(collectionId) as unknown as Source[];
}

export async function listDocuments(collectionId: number, sourceId = 0): Promise<Document[]> {
  return AppService.ListDocuments(collectionId, sourceId) as unknown as Document[];
}

export async function search(query: string, filters: SearchFilters): Promise<SearchResult[]> {
  return SearchService.Search(query, filterToBackend(filters) as never) as unknown as SearchResult[];
}

export async function getConfig(): Promise<AppConfig> {
  return IndexService.GetConfig() as unknown as AppConfig;
}

export async function setConfig(cfg: AppConfig): Promise<void> {
  return IndexService.SetConfig(cfg as never);
}

export async function addSourcePath(kind: string, name: string, path: string): Promise<void> {
  return IndexService.AddSourcePath(kind, name, path);
}

export async function removeSourcePath(kind: string, name: string, path: string): Promise<void> {
  return IndexService.RemoveSourcePath(kind, name, path);
}

export async function toggleCollectionEnabled(name: string, enabled: boolean): Promise<void> {
  return IndexService.ToggleCollectionEnabled(name, enabled);
}

export async function indexCollection(name: string, force = false): Promise<boolean> {
  // true = the run started; false = another index is already in progress.
  return IndexService.IndexCollection(name, force) as unknown as boolean;
}

export async function indexAll(force = false): Promise<boolean> {
  return IndexService.IndexAll(force) as unknown as boolean;
}

export async function cancelIndexing(): Promise<boolean> {
  return IndexService.CancelIndexing() as unknown as boolean;
}

/**
 * Returns a snapshot of the active index run (if any) so a freshly loaded
 * frontend can rebuild the indexing UI after a reload/reconnect. Live updates
 * still arrive as events; this only seeds the initial state.
 */
export async function getIndexingState(): Promise<IndexState> {
  return IndexService.GetIndexingState() as unknown as IndexState;
}

export async function prune(name: string): Promise<void> {
  await IndexService.Prune(name);
}

/** Deletes one indexed source and everything cascading from it (documents,
    embeddings, FTS). The path stays in config. Returns docs removed. */
export async function deleteSource(sourceId: number): Promise<number> {
  return IndexService.DeleteSource(sourceId) as unknown as number;
}

/** Deletes a collection and everything cascading from it, and removes its
    config entry so it doesn't come back on the next index pass. Returns docs
    removed. */
export async function deleteCollection(name: string): Promise<number> {
  return IndexService.DeleteCollection(name) as unknown as number;
}

/** Returns every installed model (folder scan + reconcile happens server-side). */
export async function listModels(): Promise<ModelInfo[]> {
  return ModelService.ListModels() as unknown as ModelInfo[];
}

/** Copies a .gguf into the models/ folder and registers it. */
export async function importModel(path: string): Promise<ModelInfo> {
  return ModelService.ImportModel(path) as unknown as ModelInfo;
}

/**
 * Makes the model at path active. When switching would change the embedding
 * dimension the backend does NOT apply it and returns needsRebuild=true; the
 * UI confirms the destructive re-index, then calls setActiveModel(path, true).
 */
export async function setActiveModel(path: string, force = false): Promise<SetActiveResult> {
  return ModelService.SetActiveModel(path, force) as unknown as SetActiveResult;
}

/** Removes a model from the table (and its file when it's in models/). */
export async function deleteModel(path: string): Promise<void> {
  await ModelService.DeleteModel(path);
}

/** Updates one model's per-model settings (context window, batch, threads). */
export async function updateModelSettings(
  id: number,
  contextWindow: number,
  batchSize: number,
  threads: number,
): Promise<void> {
  await ModelService.UpdateModelSettings(id, contextWindow, batchSize, threads);
}

/**
 * Opens the native OS file picker for a .gguf embedding model. Returns the
 * chosen path (empty string if the user cancels).
 */
export async function pickModelFile(): Promise<string> {
  try {
    const picked = await Dialogs.OpenFile({
      Title: "Choose an embedding model",
      CanChooseDirectories: false,
      CanChooseFiles: true,
      CanCreateDirectories: false,
      AllowsMultipleSelection: false,
      Filters: [{ DisplayName: "GGUF model", Pattern: "*.gguf" }],
    });
    return (picked as string) ?? "";
  } catch {
    return "";
  }
}

/**
 * Opens the native OS folder picker and returns the chosen directory path
 * (empty string if the user cancels). Used wherever the app collects paths.
 */
export async function pickFolder(title = "Choose a folder"): Promise<string> {
  try {
    const picked = await Dialogs.OpenFile({
      Title: title,
      CanChooseDirectories: true,
      CanChooseFiles: false,
      CanCreateDirectories: true,
      AllowsMultipleSelection: false,
    });
    return (picked as string) ?? "";
  } catch {
    return "";
  }
}

/** Opens a file or folder with the OS default application. */
export async function openFile(path: string): Promise<void> {
  await AppService.OpenFile(path);
}

/** Selects a file in the OS file manager (opens the parent folder for a dir). */
export async function revealInFolder(path: string): Promise<void> {
  await AppService.RevealInFolder(path);
}
