import type {
  Collection,
  Document,
  SearchFilters,
  SearchResult,
  Source,
} from "./types";

/* ------------------------------------------------------------------ */
/* Collections                                                          */
/* ------------------------------------------------------------------ */

export const mockCollections: Collection[] = [
  {
    id: "obsidian",
    name: "obsidian",
    type: "system",
    description: "Your notes vault, all file types.",
    sources: 42,
    chunks: 1286,
    created: "2026-02-14",
    enabled: true,
  },
  {
    id: "email",
    name: "email",
    type: "system",
    description: "eM Client archive, read only.",
    sources: 318,
    chunks: 2041,
    created: "2026-02-14",
    enabled: true,
  },
  {
    id: "calibre",
    name: "calibre",
    type: "system",
    description: "Books and PDFs with author metadata.",
    sources: 96,
    chunks: 4890,
    created: "2026-03-02",
    enabled: true,
  },
  {
    id: "rss",
    name: "rss",
    type: "system",
    description: "Saved articles from your feeds.",
    sources: 212,
    chunks: 732,
    created: "2026-03-09",
    enabled: true,
  },
  {
    id: "rustyquill",
    name: "rustyquill",
    type: "code",
    description: "A repo group — 3 repos, tree-sitter parsed.",
    sources: 127,
    chunks: 6411,
    created: "2026-04-01",
    enabled: true,
  },
  {
    id: "home-lab",
    name: "home-lab",
    type: "project",
    description: "Proxmox, containers, and network notes.",
    sources: 18,
    chunks: 402,
    created: "2026-05-17",
    enabled: true,
  },
  {
    id: "field-notes",
    name: "field-notes",
    type: "project",
    description: "Camera and hiking journals.",
    sources: 9,
    chunks: 154,
    created: "2026-06-22",
    enabled: true,
  },
];

/* ------------------------------------------------------------------ */
/* Sources (for Library detail + Browse file tree)                      */
/* ------------------------------------------------------------------ */

export const mockSources: Source[] = [
  { id: "s1", collectionId: "obsidian", sourceType: "markdown", path: "vault/Projects/Kubernetes.md", chunks: 34, lastIndexed: "2026-08-20" },
  { id: "s2", collectionId: "obsidian", sourceType: "markdown", path: "vault/Notes/Backup strategy.md", chunks: 12, lastIndexed: "2026-08-20" },
  { id: "s3", collectionId: "obsidian", sourceType: "pdf", path: "vault/Reference/Proxmox HA.pdf", chunks: 18, lastIndexed: "2026-08-19" },
  { id: "s4", collectionId: "email", sourceType: "email", path: "inbox/2026/invoice-supplier-0421", chunks: 2, lastIndexed: "2026-08-18" },
  { id: "s5", collectionId: "email", sourceType: "email", path: "inbox/2026/talks-golang-meetup", chunks: 3, lastIndexed: "2026-08-18" },
  { id: "s6", collectionId: "calibre", sourceType: "epub", path: "books/Understanding Exposure.epub", chunks: 96, lastIndexed: "2026-08-17" },
  { id: "s7", collectionId: "calibre", sourceType: "pdf", path: "books/Designing Data-Intensive Applications.pdf", chunks: 210, lastIndexed: "2026-08-17" },
  { id: "s8", collectionId: "rss", sourceType: "rss", path: "feeds/lobsters/ray-tracing-weekly", chunks: 4, lastIndexed: "2026-08-21" },
  { id: "s9", collectionId: "rustyquill", sourceType: "code", path: "rustyquill/router/internal/store/store.go", chunks: 41, lastIndexed: "2026-08-16" },
  { id: "s10", collectionId: "rustyquill", sourceType: "code", path: "rustyquill/router/internal/api/handlers.go", chunks: 27, lastIndexed: "2026-08-16" },
  { id: "s11", collectionId: "home-lab", sourceType: "txt", path: "lab/proxmox/cluster-notes.txt", chunks: 9, lastIndexed: "2026-08-14" },
  { id: "s12", collectionId: "field-notes", sourceType: "markdown", path: "field-notes/2026/summer/north-rim.md", chunks: 7, lastIndexed: "2026-08-12" },
];

/* ------------------------------------------------------------------ */
/* Documents (for the Browse file tree leaves)                          */
/* ------------------------------------------------------------------ */

export const mockDocuments: Document[] = [
  {
    id: "d1",
    sourceId: "s1",
    collectionId: "obsidian",
    chunkIndex: 0,
    title: "Kubernetes deployment strategy",
    content: "We run three small clusters instead of one big one. The argument is blast radius: when a node pool goes sideways, the damage stays inside one cluster and the other two keep serving.",
    metadata: { tags: ["k8s", "infra"], heading: "Overview" },
  },
  {
    id: "d2",
    sourceId: "s1",
    collectionId: "obsidian",
    chunkIndex: 1,
    title: "Rolling updates and blue-green",
    content: "For stateless services we use rolling updates with a maxUnavailable of zero. Stateful workloads go blue-green: the new revision is fully up and healthy before traffic flips.",
    metadata: { tags: ["k8s", "deploy"], heading: "Deploys" },
  },
  {
    id: "d3",
    sourceId: "s9",
    collectionId: "rustyquill",
    chunkIndex: 0,
    title: "store.go — Open",
    content: "func Open(path string) (*Store, error) {\n\tconn, err := sql.Open(\"sqlite\", path)\n\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"open store: %w\", err)\n\t}\n\tif err := InitSchema(conn); err != nil {\n\t\treturn nil, err\n\t}\n\treturn &Store{conn: conn}, nil\n}",
    metadata: { lang: "go", symbol: "Open" },
  },
  {
    id: "d4",
    sourceId: "s7",
    collectionId: "calibre",
    chunkIndex: 12,
    title: "Replication and partitioning",
    content: "Partitioning spreads data across nodes; replication provides redundancy. The two are orthogonal. A common mistake is to confuse them, and to design a system that scales reads but cannot survive losing a node.",
    metadata: { authors: ["Martin Kleppmann"], page: 204 },
  },
  {
    id: "d5",
    sourceId: "s6",
    collectionId: "calibre",
    chunkIndex: 30,
    title: "The exposure triangle",
    content: "Aperture, shutter speed, and ISO are the three dials. Opening the aperture one stop halves the light reaching the sensor, and you trade depth of field for it. Shutter freezes motion, ISO buys sensitivity at the cost of noise.",
    metadata: { authors: ["Bryan Peterson"], page: 58 },
  },
  {
    id: "d6",
    sourceId: "s4",
    collectionId: "email",
    chunkIndex: 0,
    title: "Invoice from supplier",
    content: "Please find attached invoice INV-2048 for the March delivery of shelving and hardware. Payment terms are net 30. Let me know if the packing slip does not match what we agreed on.",
    metadata: { sender: "orders@northsupply.example", date: "2026-07-02" },
  },
  {
    id: "d7",
    sourceId: "s12",
    collectionId: "field-notes",
    chunkIndex: 0,
    title: "North Rim, day one",
    content: "Up at 5:40, on the trail by 6:30. The light on the canyon walls was flat until about 8, then it got sharp fast. Shot most of the morning at f/8 with the 24mm, ISO 100, a few frames at f/2.8 for the rim trail.",
    metadata: { place: "Grand Canyon", tags: ["hiking", "photography"] },
  },
  {
    id: "d8",
    sourceId: "s8",
    collectionId: "rss",
    chunkIndex: 0,
    title: "A week of ray tracing",
    content: "Building a small path tracer in Go taught me more about Monte Carlo sampling than any textbook. The key insight: importance sampling your light sources makes the noise vanish at a fraction of the sample count.",
    metadata: { feed: "lobsters", author: "r4di" },
  },
  {
    id: "d9",
    sourceId: "s11",
    collectionId: "home-lab",
    chunkIndex: 0,
    title: "Cluster notes — quorum",
    content: "Proxmox wants an odd number of nodes for quorum. Three nodes means we survive one failure. Anything that writes to the cluster DB needs quorum, so watch the watchdog when a node drops.",
    metadata: { tags: ["proxmox", "cluster"] },
  },
];

/* ------------------------------------------------------------------ */
/* Search                                                               */
/* ------------------------------------------------------------------ */

export const mockSearchResults: SearchResult[] = [
  {
    content:
      "For stateless services we use rolling updates with a maxUnavailable of zero. Stateful workloads go blue-green: the new revision is fully up and healthy before traffic flips.",
    title: "Rolling updates and blue-green",
    metadata: { tags: ["k8s", "deploy"] },
    score: 0.91,
    collection: "obsidian",
    sourcePath: "vault/Projects/Kubernetes.md",
    sourceType: "markdown",
  },
  {
    content:
      "Partitioning spreads data across nodes; replication provides redundancy. The two are orthogonal. A common mistake is to confuse them, and to design a system that scales reads but cannot survive losing a node.",
    title: "Replication and partitioning",
    metadata: { authors: ["Martin Kleppmann"], page: 204 },
    score: 0.88,
    collection: "calibre",
    sourcePath: "books/Designing Data-Intensive Applications.pdf",
    sourceType: "pdf",
  },
  {
    content:
      "Aperture, shutter speed, and ISO are the three dials. Opening the aperture one stop halves the light reaching the sensor, and you trade depth of field for it. Shutter freezes motion, ISO buys sensitivity at the cost of noise.",
    title: "The exposure triangle",
    metadata: { authors: ["Bryan Peterson"], page: 58 },
    score: 0.84,
    collection: "calibre",
    sourcePath: "books/Understanding Exposure.epub",
    sourceType: "epub",
  },
  {
    content:
      "func Open(path string) (*Store, error) {\n\tconn, err := sql.Open(\"sqlite\", path)\n\tif err != nil {\n\t\treturn nil, fmt.Errorf(\"open store: %w\", err)\n\t}\n\tif err := InitSchema(conn); err != nil {\n\t\treturn nil, err\n\t}\n\treturn &Store{conn: conn}, nil\n}",
    title: "store.go — Open",
    metadata: { lang: "go", symbol: "Open" },
    score: 0.82,
    collection: "rustyquill",
    sourcePath: "rustyquill/router/internal/store/store.go",
    sourceType: "code",
  },
  {
    content:
      "Please find attached invoice INV-2048 for the March delivery of shelving and hardware. Payment terms are net 30. Let me know if the packing slip does not match what we agreed on.",
    title: "Invoice from supplier",
    metadata: { sender: "orders@northsupply.example", date: "2026-07-02" },
    score: 0.79,
    collection: "email",
    sourcePath: "inbox/2026/invoice-supplier-0421",
    sourceType: "email",
  },
  {
    content:
      "Building a small path tracer in Go taught me more about Monte Carlo sampling than any textbook. The key insight: importance sampling your light sources makes the noise vanish at a fraction of the sample count.",
    title: "A week of ray tracing",
    metadata: { feed: "lobsters", author: "r4di" },
    score: 0.74,
    collection: "rss",
    sourcePath: "feeds/lobsters/ray-tracing-weekly",
    sourceType: "rss",
  },
  {
    content:
      "Proxmox wants an odd number of nodes for quorum. Three nodes means we survive one failure. Anything that writes to the cluster DB needs quorum, so watch the watchdog when a node drops.",
    title: "Cluster notes — quorum",
    metadata: { tags: ["proxmox", "cluster"] },
    score: 0.71,
    collection: "home-lab",
    sourcePath: "lab/proxmox/cluster-notes.txt",
    sourceType: "txt",
  },
  {
    content:
      "Up at 5:40, on the trail by 6:30. The light on the canyon walls was flat until about 8, then it got sharp fast. Shot most of the morning at f/8 with the 24mm, ISO 100, a few frames at f/2.8 for the rim trail.",
    title: "North Rim, day one",
    metadata: { place: "Grand Canyon", tags: ["hiking", "photography"] },
    score: 0.66,
    collection: "field-notes",
    sourcePath: "field-notes/2026/summer/north-rim.md",
    sourceType: "markdown",
  },
];

/** Instant, deterministic mock of hybrid search. Filters are honored
    coarsely; the real llama.go path replaces this later. */
export function mockSearch(query: string, filters: SearchFilters): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = mockSearchResults
    .map((r) => {
      const hay = `${r.title} ${r.content} ${r.collection} ${r.sourcePath}`.toLowerCase();
      let hits = 0;
      for (const t of terms) if (hay.includes(t)) hits++;
      return { r, hits };
    })
    .filter(({ hits }) => hits > 0)
    .filter(({ r }) => !filters.collection || r.collection === filters.collection)
    .filter(({ r }) => !filters.sourceType || r.sourceType === filters.sourceType)
    .filter(({ r }) => !filters.path || r.sourcePath.toLowerCase().includes(filters.path.toLowerCase()));

  return scored.slice(0, filters.topK).map(({ r, hits }) => ({
    ...r,
    score: Math.min(0.97, 0.5 + hits * 0.14),
  }));
}

/** Query terms, for snippet highlighting. */
export function termsOf(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export const exampleQueries = [
  "kubernetes rollout",
  "exposure triangle",
  "quorum",
  "invoice from supplier",
];
