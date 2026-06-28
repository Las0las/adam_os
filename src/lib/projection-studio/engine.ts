// Projection Studio — the pure, deterministic governed engine.
//
// Owns no React and no I/O of its own. Every function is a pure transform over
// plain data, so the entire Source→Evidence→Recommendation→Patch→Compile→
// Validate→Preview flow is replayable. Constitutional validation calls the REAL
// kernel (Constitution Runtime) to mint an ExecutionAuthority — it is never
// faked, and a patch can never reach the preview without it.

import { Kernel, stableStringHash } from "@/lib/kernel";
import type { ConstitutionActor } from "@/lib/constitution";
import type { ProjectionDefinition } from "@/lib/projection-runtime/contracts/projection-definition";
import type {
  AcquisitionSession,
  BuilderRecommendation,
  CompilerEnv,
  CompilerIssue,
  CompilerResult,
  ConstitutionalValidationResult,
  DiffHunk,
  EvidenceObject,
  PatchDiff,
  ProjectionPatch,
  SessionAuthority,
  SourceKind,
  SourceObject,
  SourceRef,
  StudioJournalEntry,
} from "./contracts";

// ── DSL (serialize / parse) ──────────────────────────────────────────────────

export function serializeDsl(def: ProjectionDefinition): string {
  return JSON.stringify(def, null, 2);
}

export function parseDsl(text: string): { ok: true; def: ProjectionDefinition } | { ok: false; error: string } {
  try {
    const def = JSON.parse(text) as ProjectionDefinition;
    return { ok: true, def };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

// ── Deterministic ids ──────────────────────────────────────────────────────--

function id(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}_${stableStringHash(parts.join("·")).slice(0, 8)}`;
}

const CONFIDENCE_BY_KIND: Record<SourceKind, number> = {
  constitution: 0.98,
  enterprise_graph: 0.94,
  runtime_explorer: 0.92,
  docs: 0.86,
  github: 0.82,
  api: 0.8,
  sharepoint: 0.72,
  email: 0.66,
  slack: 0.6,
  browser_tab: 0.55,
  web: 0.5,
};

// ── Mock governed source index (deterministic, enterprise context) ─────────────

const SOURCE_INDEX: Record<SourceKind, { title: string; locator: string; snippet: string }[]> = {
  docs: [
    {
      title: "Projection surface guidelines — labels & help text",
      locator: "docs://projection/surface-guidelines#labels",
      snippet:
        "Form surfaces should group identity fields first and expose a one-line description so reviewers understand the projection's intent.",
    },
    {
      title: "Candidate object field reference",
      locator: "docs://ontology/candidate#fields",
      snippet: "Candidate exposes fullName, email, location, summary, status. 'summary' is a free-text profile field.",
    },
  ],
  enterprise_graph: [
    {
      title: "Candidate → most-used fields (last 90d)",
      locator: "graph://Candidate/usage/fields",
      snippet: "Across create surfaces, 'location' and 'summary' are completed in 91% of governed Candidate.CreateRequested intents.",
    },
  ],
  runtime_explorer: [
    {
      title: "Projection composer — render plan for Candidate.Create.FullPage",
      locator: "runtime://projection-composer/Candidate.Create.FullPage",
      snippet: "Plan resolves 3 sections; the 'lifecycle' section renders a single status field. Replay fingerprint stable.",
    },
  ],
  constitution: [
    {
      title: "Article — projections never own truth",
      locator: "constitution://articles/projection-authority",
      snippet: "A projection may only surface fields declared on the referenced object definition. New fields require an object amendment, not a projection patch.",
    },
  ],
  github: [
    {
      title: "PR #482 — add location to candidate create",
      locator: "github://org/repo/pull/482",
      snippet: "Reviewers requested 'location' be added to the identity section of the create projection for field completeness.",
    },
  ],
  api: [{ title: "ATS export schema", locator: "api://ats/v2/candidates/schema", snippet: "Fields: full_name, email, city, stage." }],
  sharepoint: [{ title: "Hiring intake template", locator: "sp://HR/Hiring/intake.docx", snippet: "Intake form collects name, email, location, summary." }],
  email: [{ title: "Re: create form feedback", locator: "mail://thread/9931", snippet: "Recruiters want a location field on the new candidate form." }],
  slack: [{ title: "#recruiting-tools", locator: "slack://C04/p17", snippet: "Can we add location to the create projection? keeps getting asked." }],
  web: [{ title: "Form UX best practices", locator: "https://example.com/form-ux", snippet: "Group related fields; keep create forms short." }],
  browser_tab: [{ title: "Open tab — internal wiki: Candidate", locator: "tab://wiki/Candidate", snippet: "Candidate profile includes location and summary." }],
};

// ── Session lifecycle ──────────────────────────────────────────────────────--

export function startAcquisitionSession(input: {
  mission: string;
  targetArtifact: string;
  authority: SessionAuthority;
  at: string;
}): AcquisitionSession {
  const sessionId = id("acq", input.mission, input.targetArtifact, input.authority.authorityId);
  return {
    sessionId,
    mission: input.mission,
    targetArtifact: input.targetArtifact,
    sources: [],
    searches: [],
    captures: [],
    evidence: [],
    recommendations: [],
    acceptedPatches: [],
    rejectedPatches: [],
    authority: input.authority,
    journalEntries: [
      {
        seq: 1,
        at: input.at,
        phase: "acquisition",
        kind: "search",
        summary: `Session opened for ${input.targetArtifact} under authority ${input.authority.authorityId}`,
      },
    ],
  };
}

export function appendJournalEntry(
  session: AcquisitionSession,
  entry: Omit<StudioJournalEntry, "seq">,
): AcquisitionSession {
  const seq = session.journalEntries.length + 1;
  return { ...session, journalEntries: [...session.journalEntries, { ...entry, seq }] };
}

// ── Search / capture / normalize ───────────────────────────────────────────--

export function searchSources(kind: SourceKind, query: string): SourceRef[] {
  const entries = SOURCE_INDEX[kind] ?? [];
  const q = query.trim().toLowerCase();
  return entries.map((e, i) => {
    const hay = `${e.title} ${e.snippet}`.toLowerCase();
    const hit = q.length === 0 ? 0.4 : hay.includes(q) ? 0.95 : 0.55 - i * 0.05;
    return {
      sourceRefId: id("src", kind, e.locator, query),
      kind,
      title: e.title,
      locator: e.locator,
      snippet: e.snippet,
      relevance: Math.max(0.2, Math.min(0.99, hit)),
    };
  });
}

export function captureSource(ref: SourceRef, at: string): SourceObject {
  return {
    sourceObjectId: id("so", ref.sourceRefId),
    ref,
    capturedAt: at,
    rawContent: ref.snippet,
    normalized: false,
  };
}

export function normalizeSource(source: SourceObject): SourceObject {
  if (source.normalized) return source;
  const summary = source.ref.snippet.replace(/\s+/g, " ").trim();
  return { ...source, normalized: true, normalizedSummary: summary };
}

// ── Evidence ───────────────────────────────────────────────────────────────--

export function bindAsEvidence(source: SourceObject): EvidenceObject {
  const normalized = normalizeSource(source);
  const ref = normalized.ref;
  return {
    evidenceId: id("ev", normalized.sourceObjectId),
    sourceRef: ref,
    contextRef: {
      contextRefId: id("ctx", normalized.sourceObjectId),
      sourceObjectId: normalized.sourceObjectId,
      kind: ref.kind,
      label: ref.title,
    },
    claim: normalized.normalizedSummary ?? ref.snippet,
    provenance: `${ref.kind} · ${ref.locator} · captured ${normalized.capturedAt}`,
    confidence: CONFIDENCE_BY_KIND[ref.kind] ?? 0.5,
    sourceType: ref.kind,
    capturedAt: normalized.capturedAt,
    bindStatus: "bound",
  };
}

// ── Builder recommendation (grounded ONLY in bound evidence) ───────────────--

export function generateRecommendation(
  targetProjectionId: string,
  evidence: EvidenceObject[],
): BuilderRecommendation | { error: string } {
  const bound = evidence.filter((e) => e.bindStatus === "bound");
  if (bound.length === 0) return { error: "No bound evidence — a recommendation must cite evidence." };
  const avg = bound.reduce((a, e) => a + e.confidence, 0) / bound.length;
  // The mock builder reads the evidence and proposes the most-supported change:
  // add a 'location' field to the identity section of the create projection.
  const mentionsLocation = bound.some((e) => /location|city/i.test(e.claim));
  const proposedChange = mentionsLocation
    ? "Add 'location' to the identity section so the create surface captures it (field already declared on the object)."
    : "Refine the projection description to match the documented intent of the surface.";
  return {
    recommendationId: id("rec", targetProjectionId, bound.map((e) => e.evidenceId).join(",")),
    targetProjectionId,
    rationale: `${bound.length} evidence object(s) converge on this change (avg confidence ${(avg * 100).toFixed(0)}%).`,
    evidenceRefs: bound.map((e) => e.evidenceId),
    proposedChange,
    confidence: Number(avg.toFixed(2)),
  };
}

// ── Patch proposal + diff ────────────────────────────────────────────────────

function lineDiff(before: string, after: string): DiffHunk[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const hunks: DiffHunk[] = [];
  // Removed lines (in A, not B).
  for (const line of a) if (!setB.has(line)) hunks.push({ kind: "remove", text: line });
  // Added lines (in B, not A).
  for (const line of b) if (!setA.has(line)) hunks.push({ kind: "add", text: line });
  return hunks;
}

/** Apply the recommendation as a concrete, declarative ProjectionPatch. Computes
 *  the before/after DSL diff but does NOT mutate anything — the patch is a
 *  proposal awaiting compile + constitutional approval. */
export function proposeProjectionPatch(input: {
  recommendation: BuilderRecommendation;
  currentDef: ProjectionDefinition;
  evidence: EvidenceObject[];
  author: string;
}): ProjectionPatch {
  const { recommendation, currentDef, evidence, author } = input;
  const cited = evidence.filter((e) => recommendation.evidenceRefs.includes(e.evidenceId));
  const addsLocation = /location/i.test(recommendation.proposedChange);

  const proposed: ProjectionDefinition = structuredClone(currentDef);
  const affectedRegions: string[] = [];

  if (addsLocation && proposed.layout && proposed.layout.length > 0) {
    const identity = proposed.layout.find((s) => s.id === "identity") ?? proposed.layout[0];
    if (!identity.fields.includes("location")) {
      identity.fields = [...identity.fields, "location"];
      affectedRegions.push(`layout.${identity.id}.fields`);
    }
  } else {
    proposed.description = `${currentDef.title} — ${recommendation.proposedChange}`;
    affectedRegions.push("description");
  }

  const before = serializeDsl(currentDef);
  const after = serializeDsl(proposed);
  const diff: PatchDiff = { before, after, hunks: lineDiff(before, after) };

  return {
    patchId: id("patch", recommendation.recommendationId, after),
    targetProjectionId: recommendation.targetProjectionId,
    reason: recommendation.proposedChange,
    evidenceRefs: recommendation.evidenceRefs,
    sourceRefs: cited.map((e) => e.sourceRef.sourceRefId),
    affectedRegions,
    confidence: recommendation.confidence,
    author,
    diff,
    ops: addsLocation
      ? [{ op: "add_field", sectionId: "identity", field: "location" }]
      : [{ op: "set_description", value: `${currentDef.title} — ${recommendation.proposedChange}` }],
    reviewState: "in_review",
    compilerStatus: "pending",
    constitutionStatus: "pending",
  };
}

// ── Compiler (validates the proposed ProjectionDefinition) ─────────────────--

const VALID_SURFACES = new Set(["modal", "drawer", "fullPage", "grid", "calendar", "document", "graph", "command"]);
const VALID_MODES = new Set(["create", "edit", "view", "list"]);

export function compilePatch(env: CompilerEnv, patch: ProjectionPatch): CompilerResult {
  const errors: CompilerIssue[] = [];
  const warnings: CompilerIssue[] = [];

  const parsed = parseDsl(patch.diff.after);
  if (!parsed.ok) {
    return { ok: false, status: "failed", errors: [{ code: "DSL_PARSE", message: parsed.error }], warnings, compiledFingerprint: null, compiled: null };
  }
  const def = parsed.def;

  if (!def.id) errors.push({ code: "MISSING_ID", message: "Projection id is required." });
  if (!def.title) errors.push({ code: "MISSING_TITLE", message: "Projection title is required.", region: "title" });
  if (!def.objectType || !env.objectTypes.includes(def.objectType))
    errors.push({ code: "UNKNOWN_OBJECT", message: `objectType '${def.objectType}' is not a registered enterprise object.`, region: "objectType" });
  if (!VALID_SURFACES.has(def.surface)) errors.push({ code: "BAD_SURFACE", message: `surface '${def.surface}' is not a valid surface.`, region: "surface" });
  if (!VALID_MODES.has(def.mode)) errors.push({ code: "BAD_MODE", message: `mode '${def.mode}' is not a valid mode.`, region: "mode" });

  const knownFields = env.fieldsByObjectType[def.objectType] ?? [];
  // THE constitutional compiler rule: a projection may only reference fields
  // declared on the object definition. New fields require an object amendment.
  for (const section of def.layout ?? []) {
    for (const f of section.fields) {
      if (!knownFields.includes(f))
        errors.push({ code: "UNDECLARED_FIELD", message: `Field '${f}' is not declared on ${def.objectType}.`, region: `layout.${section.id}` });
    }
  }
  for (const col of def.display?.columns ?? []) {
    if (!knownFields.includes(col.field))
      errors.push({ code: "UNDECLARED_FIELD", message: `Column '${col.field}' is not declared on ${def.objectType}.`, region: "display.columns" });
  }

  const knownIntents = env.intentsByObjectType[def.objectType] ?? [];
  if (def.primaryIntent && !knownIntents.includes(def.primaryIntent))
    warnings.push({ code: "UNKNOWN_INTENT", message: `primaryIntent '${def.primaryIntent}' is not declared on ${def.objectType}.`, region: "primaryIntent" });

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? "passed" : "failed",
    errors,
    warnings,
    compiledFingerprint: ok ? stableStringHash(serializeDsl(def)).slice(0, 12) : null,
    compiled: ok ? def : null,
  };
}

// ── Constitutional validation (REAL kernel authority) ──────────────────────--

export function constitutionallyValidate(input: {
  patch: ProjectionPatch;
  compiler: CompilerResult;
  actor: ConstitutionActor;
  enterpriseId: string;
  now?: number;
}): ConstitutionalValidationResult {
  const { patch, compiler, actor, enterpriseId } = input;
  // Mint a REAL ExecutionAuthority from the Constitution Runtime. Editing a
  // projection definition is a governed mutation of a ProjectionDefinition object.
  const authority = Kernel.requestAuthority(
    {
      kind: "object.update",
      actor,
      enterpriseId,
      object: { objectType: "ProjectionDefinition", objectId: patch.targetProjectionId, isMutation: true },
      audited: true,
    },
    input.now ?? Date.now(),
  );

  // The hard gate: approved ONLY when the kernel granted authority, the compiler
  // passed, and the patch is grounded in at least one evidence object.
  const grounded = patch.evidenceRefs.length > 0;
  const approved = authority.granted && compiler.ok && grounded;
  const reason = !authority.granted
    ? "Constitution Runtime denied authority for this projection mutation."
    : !compiler.ok
      ? "Compiler did not pass — cannot validate an invalid definition."
      : !grounded
        ? "Patch is not grounded in evidence — ungoverned patches are rejected."
        : "Authority granted, compiler passed, evidence present.";

  return {
    approved,
    status: approved ? "approved" : "rejected",
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    granted: authority.granted,
    capabilities: authority.capabilities,
    restrictions: authority.restrictions,
    signature: authority.signature,
    reason,
  };
}

/** Apply the patch — ONLY valid after compile passed AND constitution approved.
 *  Returns the new compiled ProjectionDefinition that the Live Preview renders. */
export function applyPatch(
  patch: ProjectionPatch,
  compiler: CompilerResult,
  validation: ConstitutionalValidationResult,
): { ok: true; def: ProjectionDefinition } | { ok: false; error: string } {
  if (patch.compilerStatus !== "passed" || !compiler.compiled)
    return { ok: false, error: "Compiler has not passed." };
  if (patch.constitutionStatus !== "approved" || !validation.approved)
    return { ok: false, error: "Constitution has not approved." };
  return { ok: true, def: compiler.compiled };
}
