/* Types mirror the Go backend models (backend/services, backend/search,
   backend/config) so the UI talks to the Wails bindings without reshaping. */

export type CollectionType = "system" | "project" | "code";

export type SourceType =
  | "markdown"
  | "pdf"
  | "docx"
  | "html"
  | "plaintext"
  | "epub"
  | "code"
  | "commit"
  | "calibre-description"
  | "email"
  | "rss"; // macOS-only; kept for filter options

export interface Collection {
  id: number;
  name: string;
  type: string;
  description: string;
  sources: number;
  chunks: number;
  created: string;
  enabled: boolean;
}

export interface Source {
  id: number;
  collectionId: number;
  sourceType: string;
  path: string;
  chunks: number;
  lastIndexed?: string;
}

export interface Document {
  id: number;
  sourceId: number;
  collectionId: number;
  chunkIndex: number;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

/** Mirrors search.SearchResult. */
export interface SearchResult {
  content: string;
  title: string;
  metadata: Record<string, unknown>;
  score: number;
  collection: string;
  sourcePath: string;
  sourceType: string;
}

/** Mirrors search.Filters. */
export interface SearchFilters {
  collection?: string;
  sourceType?: string;
  path?: string;
  sender?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  metadataFilters?: Record<string, string>;
  topK: number;
}

export type ViewId = "search" | "library" | "browse" | "index" | "settings";
export type ModelState = "loaded" | "idle" | "failed";

/** Mirrors services.Status. */
export interface Status {
  collections: number;
  sources: number;
  chunks: number;
  dbSize: number;
  modelState: ModelState;
  modelName: string;
  modelPath: string;
  modelError: string;
}

/** Mirrors config.SearchDefaults / GUIConfig / Config (snake_case JSON). */
export interface SearchDefaults {
  top_k: number;
  rrf_k: number;
  vector_weight: number;
  fts_weight: number;
}

export interface GUIConfig {
  auto_reindex: boolean;
  auto_reindex_interval_minutes: number;
  start_on_login: boolean;
}

export interface AppConfig {
  embedding_model: string;
  embedding_batch_size: number;
  chunk_size_tokens: number;
  chunk_overlap_tokens: number;
  obsidian_vaults: string[];
  obsidian_exclude_folders: string[];
  calibre_libraries: string[];
  repositories: Record<string, string[]>;
  projects: Record<string, string[]>;
  disabled_collections: string[];
  skip_cloud_placeholders: boolean;
  git_history_in_months: number;
  git_commit_subject_blacklist: string[];
  search_defaults: SearchDefaults;
  gui: GUIConfig;
}

/** Mirrors services.IndexProgress / IndexComplete (indexing events). */
export interface IndexProgress {
  collection: string;
  current: number;
  total: number;
  item: string;
}

export interface IndexComplete {
  collection: string;
  indexed: number;
  skipped: number;
  errors: number;
  messages: string[];
}
