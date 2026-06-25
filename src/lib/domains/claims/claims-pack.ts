// Claims / Validation seed pack (§52). Registers a ClaimDocument object mapper,
// extraction / reasoning / summarization functions, a manual-review action, and
// a claim-validation agent. Self-registers via side-effect imports.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { registerObjectMapper } from "@/lib/dataops/ontology/object-mapper-registry";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { extractStructuredFields } from "@/lib/aiops/functions/builtins/extract-structured-fields";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition } from "@/types/aiops";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

// ── Object mapper: ClaimDocument ────────────────────────────────────────
registerObjectMapper({
  key: "claims",
  map(ctx: ActorContext, record: CanonicalRecord): OntologyObject[] {
    const p = record.payload;
    const claimId = str(p.claim_id);
    if (!claimId) return [];
    const claim = upsertObject(ctx, {
      objectType: "ClaimDocument",
      externalKey: claimId,
      title: `Claim ${claimId}`,
      status: "open",
      properties: {
        amount: p.amount ?? null,
        claimant: str(p.claimant),
      },
    });
    return [claim];
  },
});

// ── Function: extract_claim_fields (delegates to the built-in extractor) ─
const extractClaimFields: LawrenceFunction<
  { text?: unknown; schema?: unknown },
  Record<string, unknown>
> = {
  key: "extract_claim_fields",
  name: "Extract claim fields",
  description: "Extract structured claim fields (amount, claimant) from claim text.",
  klass: "extract",
  outputSchema: {
    type: "object",
    properties: { amount: { type: "number" }, claimant: { type: "string" } },
  },
  async run(ctx, input): Promise<FunctionExecutionResult<Record<string, unknown>>> {
    return extractStructuredFields.run(ctx, {
      text: String(input.text ?? ""),
      schema:
        (input.schema as Record<string, unknown> | undefined) ?? {
          type: "object",
          properties: { amount: { type: "number" }, claimant: { type: "string" } },
        },
    });
  },
};
registerFunction(extractClaimFields);

// ── Function: detect_contradictions ─────────────────────────────────────
// Deterministic: flag a pair of statements when one statement negates a token
// (token preceded by "not"/"no") that appears unnegated in the other.
function tokensOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function negatedTokens(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const word = tokens[i];
    const next = tokens[i + 1];
    if ((word === "not" || word === "no") && next) out.add(next);
  }
  return out;
}

const detectContradictions: LawrenceFunction<
  { statements?: unknown },
  { contradictions: Array<{ a: string; b: string }>; count: number }
> = {
  key: "detect_contradictions",
  name: "Detect contradictions",
  description: "Flag pairs of statements where one negates a key token present in the other.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      contradictions: {
        type: "array",
        items: {
          type: "object",
          properties: { a: { type: "string" }, b: { type: "string" } },
        },
      },
      count: { type: "number" },
    },
    required: ["contradictions", "count"],
  },
  async run(
    _ctx,
    input,
  ): Promise<
    FunctionExecutionResult<{ contradictions: Array<{ a: string; b: string }>; count: number }>
  > {
    const raw = Array.isArray(input.statements) ? input.statements : [];
    const statements = raw.map((s) => String(s ?? ""));
    const tokenSets = statements.map((s) => tokensOf(s));
    const negSets = tokenSets.map((t) => negatedTokens(t));
    const contradictions: Array<{ a: string; b: string }> = [];

    for (let i = 0; i < statements.length; i += 1) {
      for (let j = i + 1; j < statements.length; j += 1) {
        const a = statements[i] ?? "";
        const b = statements[j] ?? "";
        const tokensA = tokenSets[i] ?? [];
        const tokensB = tokenSets[j] ?? [];
        const negA = negSets[i] ?? new Set<string>();
        const negB = negSets[j] ?? new Set<string>();
        // i negates a token that j asserts, or vice versa.
        const conflict =
          tokensB.some((tok) => negA.has(tok)) || tokensA.some((tok) => negB.has(tok));
        if (conflict) contradictions.push({ a, b });
      }
    }

    return { output: { contradictions, count: contradictions.length } };
  },
};
registerFunction(detectContradictions);

// ── Function: summarize_evidence ────────────────────────────────────────
const summarizeEvidence: LawrenceFunction<{ caseId?: unknown }, { summary: string }> = {
  key: "summarize_evidence",
  name: "Summarize evidence",
  description: "Summarize the evidence chunks attached to a validation case.",
  klass: "summarize",
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  async run(ctx, input): Promise<FunctionExecutionResult<{ summary: string }>> {
    const caseId = String(input.caseId ?? "");
    const chunks = db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === caseId);
    const evidence = chunks
      .map((c) => c.text)
      .join(" ")
      .slice(0, 600);
    return {
      output: {
        summary: evidence
          ? `Evidence for case ${caseId}: ${evidence}`
          : `No evidence found for case ${caseId}.`,
      },
    };
  },
};
registerFunction(summarizeEvidence);

// ── Action: recommend_manual_review ─────────────────────────────────────
registerAction({
  key: "recommend_manual_review",
  requiredPermission: "review.reviewer",
  requiresApproval: false,
  precondition(_ctx, input) {
    return input.claimId ? null : "missing claimId";
  },
  async run(ctx: ActorContext, input) {
    const rc = openReviewCase(ctx, {
      caseType: "claim_validation",
      subject: { type: "ClaimDocument", id: String(input.claimId) },
      severity: (input.severity as "low" | "medium" | "high" | "critical" | undefined) ?? "high",
      summary: "High-risk claim flagged for manual review",
    });
    return { reviewCaseId: rc.id };
  },
});

/** Claim-validation agent: retrieve evidence, summarize, find contradictions,
 *  open a review case, and notify on critical findings. */
export function claimsValidationAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_claims_validation",
    tenantId,
    key: "claims_validation",
    name: "Claims validation",
    description: "Validate a claim against its evidence and route high-risk findings.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        { id: "retrieve", kind: "retrieve", config: { objectTypes: ["ClaimDocument"], methods: ["rank_fusion"] } },
        { id: "summarize", kind: "function", config: { functionKey: "summarize_evidence", input: {} } },
        { id: "contradict", kind: "function", config: { functionKey: "detect_contradictions", input: {} } },
        { id: "review", kind: "review", config: { caseType: "claim_validation", severity: "high", summary: "Review claim validation findings" } },
        { id: "notify", kind: "notify", config: { eventKey: "claim.critical_finding" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "summarize" },
        { from: "summarize", to: "contradict" },
        { from: "contradict", to: "review" },
        { from: "review", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}

/** Seed a single ClaimDocument plus contradictory evidence. */
export function seedClaims(ctx: ActorContext): void {
  const claim = upsertObject(ctx, {
    objectType: "ClaimDocument",
    externalKey: "claim-1",
    title: "Claim #1001",
    status: "open",
    properties: { amount: 5000, claimant: "Acme" },
  });
  indexEvidence(
    ctx,
    { objectType: "ClaimDocument", objectId: claim.id },
    "Invoice total is 5000. The attached receipt shows 4200. Amounts do not match.",
  );
}
