// Projection Studio — governed Context Acquisition contracts.
//
// THE RULE: external context (web/browser/docs/tools) NEVER mutates a
// ProjectionDefinition directly. Acquisition produces Source Objects → Evidence
// → ContextRef/SourceRef. The Builder may PROPOSE a ProjectionPatch. The
// Compiler validates it. The Constitution approves it. Only then does the Live
// Preview update.
//
//   Source → Capture → Normalize → Evidence → Recommendation → Patch
//          → Compiler → Constitutional Validation → Preview
//
// Everything here is plain, serializable data so the whole flow is deterministic
// and replayable across the server→client boundary.

import type { ProjectionDefinition } from "@/lib/projection-runtime/contracts/projection-definition";

/** The governed context sources. This is enterprise context acquisition — not a
 *  general web browser. */
export type SourceKind =
  | "web"
  | "browser_tab"
  | "docs"
  | "slack"
  | "email"
  | "sharepoint"
  | "github"
  | "api"
  | "runtime_explorer"
  | "enterprise_graph"
  | "constitution";

/** The governed acquisition actions a session can perform. */
export type AcquisitionActionKind =
  | "search"
  | "open"
  | "capture"
  | "summarize"
  | "normalize"
  | "bind_evidence"
  | "generate_recommendation"
  | "propose_patch";

/** A reference to an external source returned by search/open. Never editable
 *  projection content — only a pointer + snippet. */
export interface SourceRef {
  sourceRefId: string;
  kind: SourceKind;
  title: string;
  /** url / path / id / channel. */
  locator: string;
  snippet: string;
  /** 0..1 relevance to the active query. */
  relevance: number;
}

/** Raw captured content from a source, before it can become evidence. */
export interface SourceObject {
  sourceObjectId: string;
  ref: SourceRef;
  capturedAt: string;
  rawContent: string;
  normalized: boolean;
  normalizedSummary?: string;
}

/** A normalized pointer binding a captured source into the acquisition context. */
export interface ContextRef {
  contextRefId: string;
  sourceObjectId: string;
  kind: SourceKind;
  label: string;
}

export type EvidenceBindStatus = "unbound" | "bound" | "rejected";

/** A normalized, provenance-bearing claim usable by the Builder. Evidence is the
 *  ONLY thing a recommendation may cite — raw sources can never reach a patch. */
export interface EvidenceObject {
  evidenceId: string;
  sourceRef: SourceRef;
  contextRef: ContextRef;
  claim: string;
  provenance: string;
  /** 0..1 confidence in the claim. */
  confidence: number;
  sourceType: SourceKind;
  capturedAt: string;
  bindStatus: EvidenceBindStatus;
}

/** A Builder proposal grounded ONLY in bound evidence. */
export interface BuilderRecommendation {
  recommendationId: string;
  targetProjectionId: string;
  rationale: string;
  /** evidenceId[] — must be non-empty; a recommendation with no evidence is
   *  rejected by the engine. */
  evidenceRefs: string[];
  proposedChange: string;
  confidence: number;
}

/** A single declarative change operation to a ProjectionDefinition. */
export type PatchOp =
  | { op: "set_title"; value: string }
  | { op: "set_description"; value: string }
  | { op: "add_field"; sectionId: string; field: string }
  | { op: "add_section"; section: { id: string; title: string; fields: string[]; columns?: 1 | 2 } }
  | { op: "set_primary_intent"; value: string };

export interface DiffHunk {
  kind: "add" | "remove" | "context";
  text: string;
}

export interface PatchDiff {
  /** Current DSL (serialized ProjectionDefinition). */
  before: string;
  /** Proposed DSL after the ops are applied. */
  after: string;
  hunks: DiffHunk[];
}

export type CompilerStatus = "pending" | "passed" | "failed";
export type ConstitutionStatus = "pending" | "approved" | "rejected";
export type PatchReviewState = "draft" | "in_review" | "accepted" | "rejected";

/** The proposed projection change. It cannot be applied until BOTH
 *  compilerStatus === "passed" AND constitutionStatus === "approved". */
export interface ProjectionPatch {
  patchId: string;
  targetProjectionId: string;
  reason: string;
  evidenceRefs: string[];
  sourceRefs: string[];
  affectedRegions: string[];
  confidence: number;
  author: string;
  diff: PatchDiff;
  ops: PatchOp[];
  reviewState: PatchReviewState;
  compilerStatus: CompilerStatus;
  constitutionStatus: ConstitutionStatus;
}

export interface CompilerIssue {
  code: string;
  message: string;
  region?: string;
}

/** Result of compiling the proposed ProjectionDefinition. */
export interface CompilerResult {
  ok: boolean;
  status: CompilerStatus;
  errors: CompilerIssue[];
  warnings: CompilerIssue[];
  /** stableHash of the compiled definition (null when compile failed). */
  compiledFingerprint: string | null;
  /** The compiled definition (only when ok). */
  compiled: ProjectionDefinition | null;
}

/** Result of constitutional validation — backed by a REAL ExecutionAuthority
 *  minted by the kernel's Constitution Runtime. */
export interface ConstitutionalValidationResult {
  approved: boolean;
  status: ConstitutionStatus;
  authorityId: string;
  decisionId: string;
  granted: boolean;
  capabilities: string[];
  restrictions: string[];
  signature: string;
  reason: string;
}

/** One entry in the acquisition session's append-only journal. */
export interface StudioJournalEntry {
  seq: number;
  at: string;
  phase: "acquisition" | "recommendation" | "patch" | "compile" | "validation" | "preview";
  kind:
    | AcquisitionActionKind
    | "compile"
    | "validate"
    | "preview_update"
    | "patch_accept"
    | "patch_reject";
  summary: string;
}

/** The authority the session was opened under (minted server-side by the
 *  kernel and spent client-side). */
export interface SessionAuthority {
  authorityId: string;
  decisionId: string;
  granted: boolean;
  capabilities: string[];
  signature: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SessionSearch {
  searchId: string;
  kind: SourceKind;
  query: string;
  resultRefs: string[];
  at: string;
}

/** The full governed acquisition session. */
export interface AcquisitionSession {
  sessionId: string;
  mission: string;
  /** The ProjectionDefinition id being edited. */
  targetArtifact: string;
  sources: SourceObject[];
  searches: SessionSearch[];
  captures: string[];
  evidence: EvidenceObject[];
  recommendations: BuilderRecommendation[];
  acceptedPatches: string[];
  rejectedPatches: string[];
  authority: SessionAuthority;
  journalEntries: StudioJournalEntry[];
}

/** The compiler's view of the live registry, computed server-side and passed to
 *  the client so DSL field/intent references validate against REAL object
 *  definitions without importing the (server-only) runtime barrel on the client. */
export interface CompilerEnv {
  objectTypes: string[];
  surfaces: string[];
  modes: string[];
  /** objectType → valid field keys. */
  fieldsByObjectType: Record<string, string[]>;
  /** objectType → valid intent names. */
  intentsByObjectType: Record<string, string[]>;
}

/** A projection artifact shown in the left rail. */
export interface ProjectionArtifact {
  id: string;
  objectType: string;
  surface: string;
  mode: string;
  title: string;
  /** Serialized DSL of the definition. */
  dsl: string;
}
