/* Typed wrapper around the generated Wails bindings. Components only talk to
   this module, never to the raw bindings, so the API surface stays stable
   when bindings are regenerated. */

import * as AppService from "../../bindings/vectile/backend/services/appservice";
import * as IndexService from "../../bindings/vectile/backend/services/indexservice";
import * as SearchService from "../../bindings/vectile/backend/services/searchservice";
import type {
  AppConfig,
  Collection,
  Document,
  SearchFilters,
  SearchResult,
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

export async function indexCollection(name: string, force = false): Promise<void> {
  return IndexService.IndexCollection(name, force);
}

export async function indexAll(force = false): Promise<void> {
  return IndexService.IndexAll(force);
}

export async function prune(name: string): Promise<void> {
  await IndexService.Prune(name);
}
