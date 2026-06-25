// LAWRENCE DataOps domain model. See spec §7.2–§7.5, §14–§24.

export type SourceKind =
  | "upload"
  | "dataset"
  | "api"
  | "gmail"
  | "outlook"
  | "sharepoint"
  | "greenhouse"
  | "lever"
  | "gusto"
  | "webhook";

export interface Source {
  id: string;
  tenantId: string;
  name: string;
  kind: SourceKind;
  config: Record<string, unknown>;
  createdAt: string;
}

export type RawAssetKind =
  | "json"
  | "xml"
  | "xlsx"
  | "csv"
  | "pdf"
  | "docx"
  | "txt"
  | "eml"
  | "image"
  | "html"
  | "unknown";

export interface RawAsset {
  id: string;
  tenantId: string;
  sourceId?: string | null;
  kind: RawAssetKind;
  fileName: string;
  mimeType?: string | null;
  checksumSha256?: string | null;
  sizeBytes?: number | null;
  parentAssetId?: string | null;
  ingestionBatchId?: string | null;
  /** Raw bytes / text payload reference. In-memory store keeps the content here. */
  content?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type PipelineNodeKind =
  | "input"
  | "parse"
  | "transform"
  | "join"
  | "union"
  | "chunk"
  | "embed"
  | "extract"
  | "classify"
  | "summarize"
  | "output";

export interface PipelineNode {
  id: string;
  kind: PipelineNodeKind;
  label: string;
  config: Record<string, unknown>;
}

export interface PipelineEdge {
  from: string;
  to: string;
}

export interface PipelineDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  version: number;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRun {
  id: string;
  tenantId: string;
  pipelineId: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string | null;
  stats: Record<string, unknown>;
  error?: string | null;
}

export interface CanonicalDocument {
  id: string;
  tenantId: string;
  rawAssetId: string;
  documentType: string;
  title?: string | null;
  textContent?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CanonicalRecord {
  id: string;
  tenantId: string;
  documentId: string;
  recordType: string;
  payload: Record<string, unknown>;
  sourcePath?: string | null;
  createdAt: string;
}

export interface EvidenceChunk {
  id: string;
  tenantId: string;
  sourceObjectType: string;
  sourceObjectId: string;
  chunkIndex: number;
  text: string;
  metadata: Record<string, unknown>;
  embeddingId?: string | null;
  createdAt: string;
}

export interface OntologyObject {
  id: string;
  tenantId: string;
  objectType: string;
  externalKey?: string | null;
  title?: string | null;
  status?: string | null;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OntologyLink {
  id: string;
  tenantId: string;
  linkType: string;
  fromObjectType: string;
  fromObjectId: string;
  toObjectType: string;
  toObjectId: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

export interface LineageEvent {
  id: string;
  tenantId: string;
  pipelineRunId?: string | null;
  kind: string;
  fromType?: string | null;
  fromId?: string | null;
  toType: string;
  toId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// §23–§24 retrieval.
export type RetrievalMethod =
  | "keyword"
  | "vector"
  | "augmented_keyword"
  | "hyde"
  | "rank_fusion";

export interface RetrievalRequest {
  tenantId: string;
  query: string;
  objectTypes?: string[];
  subjectObjectType?: string | null;
  subjectObjectId?: string | null;
  methods: RetrievalMethod[];
  limit?: number;
}

export interface RetrievalHit {
  objectType: string;
  objectId: string;
  chunkId?: string | null;
  title?: string | null;
  excerpt: string;
  score: number;
  method: RetrievalMethod;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResponse {
  hits: RetrievalHit[];
  trace?: Record<string, unknown>;
}
