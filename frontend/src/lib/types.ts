/* Types mirror the local-rag model so the UI slice can swap mock data for
   real Wails bindings without reshaping the components. */

export type CollectionType = "system" | "project" | "code";

export type SourceType =
  | "markdown"
  | "email"
  | "pdf"
  | "docx"
  | "txt"
  | "html"
  | "epub"
  | "code"
  | "rss";

export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  description: string;
  sources: number;
  chunks: number;
  created: string; // ISO date
  enabled: boolean;
}

export interface Source {
  id: string;
  collectionId: string;
  sourceType: SourceType;
  path: string;
  chunks: number;
  lastIndexed?: string; // ISO date
}

export interface Document {
  id: string;
  sourceId: string;
  collectionId: string;
  chunkIndex: number;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** Mirrors search.SearchResult from local-rag. */
export interface SearchResult {
  content: string;
  title: string;
  metadata: Record<string, unknown>;
  score: number;
  collection: string;
  sourcePath: string;
  sourceType: SourceType;
}

/** Mirrors search.Filters from local-rag. */
export interface SearchFilters {
  collection?: string;
  sourceType?: SourceType | "";
  path?: string;
  sender?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  topK: number;
}

export type ViewId = "search" | "library" | "browse" | "index" | "settings";

export type ModelState = "loaded" | "idle" | "failed";
