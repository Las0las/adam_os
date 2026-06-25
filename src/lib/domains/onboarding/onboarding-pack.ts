// Onboarding seed pack (§50). Self-registers an object mapper, two functions,
// an escalation action, and exposes an onboarding-blocker agent + seed helper.
// Registration happens via side-effect imports of this module.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { registerObjectMapper } from "@/lib/dataops/ontology/object-mapper-registry";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition } from "@/types/aiops";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

// ── Object mapper ───────────────────────────────────────────────────────
// Projects a CanonicalRecord payload {title, status, owner} into an
// OnboardingCase ontology object.
registerObjectMapper({
  key: "onboarding",
  map(ctx: ActorContext, record: CanonicalRecord): OntologyObject[] {
    const p = record.payload;
    const title = str(p.title);
    const caseId = str(p.case_id);
    if (!title && !caseId) return [];

    const onboardingCase = upsertObject(ctx, {
      objectType: "OnboardingCase",
      externalKey: caseId ?? title,
      title: title ?? caseId,
      status: str(p.status) ?? "in_progress",
      properties: {
        owner: str(p.owner),
      },
    });
    return [onboardingCase];
  },
});

// ── Functions ───────────────────────────────────────────────────────────
// Summarize an OnboardingCase's evidence chunks.
const onboardingReadinessSummary: LawrenceFunction<{ caseId: string }, { summary: string }> = {
  key: "onboarding_readiness_summary",
  name: "Onboarding readiness summary",
  description: "Summarize an onboarding case's evidence chunks into a readiness summary.",
  klass: "summarize",
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  async run(ctx, input): Promise<FunctionExecutionResult<{ summary: string }>> {
    const chunks = db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === input.caseId);
    const evidence = chunks.map((c) => c.text).join(" ").slice(0, 600);
    return {
      output: {
        summary: `Onboarding readiness for ${input.caseId}: ${evidence || "no evidence on file"}`,
      },
    };
  },
};
registerFunction(onboardingReadinessSummary);

// Deterministic set-difference: which required docs are missing.
const detectMissingDocs: LawrenceFunction<
  { caseId: string; requiredDocs: string[]; presentDocs: string[] },
  { missing: string[]; complete: boolean }
> = {
  key: "detect_missing_docs",
  name: "Detect missing docs",
  description: "Compute which required onboarding documents are missing.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      missing: { type: "array", items: { type: "string" } },
      complete: { type: "boolean" },
    },
    required: ["missing", "complete"],
  },
  async run(_ctx, input): Promise<FunctionExecutionResult<{ missing: string[]; complete: boolean }>> {
    const present = new Set(input.presentDocs ?? []);
    const missing = (input.requiredDocs ?? []).filter((doc) => !present.has(doc));
    return { output: { missing, complete: missing.length === 0 } };
  },
};
registerFunction(detectMissingDocs);

// ── Action ──────────────────────────────────────────────────────────────
// Escalate an onboarding blocker. Internal-only side effect, no approval gate.
registerAction({
  key: "escalate_onboarding_blocker",
  requiredPermission: "notifications.manage",
  requiresApproval: false,
  precondition(_ctx, input) {
    return input.caseId ? null : "missing caseId";
  },
  async run(_ctx: ActorContext, input) {
    return { escalated: true, caseId: String(input.caseId) };
  },
});

// ── Agent ───────────────────────────────────────────────────────────────
/** An onboarding-blocker agent: retrieve case, detect missing docs, review, notify. */
export function onboardingAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_onboarding_blocker",
    tenantId,
    key: "onboarding_blocker",
    name: "Onboarding blocker",
    description: "Detect missing onboarding docs, open a review, and notify on blockers.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        { id: "retrieve", kind: "retrieve", config: { objectTypes: ["OnboardingCase"], methods: ["rank_fusion"] } },
        { id: "detect", kind: "function", config: { functionKey: "detect_missing_docs", input: {} } },
        { id: "review", kind: "review", config: { caseType: "onboarding_blocker", summary: "Review onboarding blocker", severity: "medium" } },
        { id: "notify", kind: "notify", config: { eventKey: "onboarding.blocker" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "detect" },
        { from: "detect", to: "review" },
        { from: "review", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}

// ── Seed ────────────────────────────────────────────────────────────────
/** Seed a small onboarding case with evidence. */
export function seedOnboarding(ctx: ActorContext): void {
  const onboardingCase = upsertObject(ctx, {
    objectType: "OnboardingCase",
    externalKey: "case-1",
    title: "New hire — Ada",
    status: "in_progress",
    properties: { owner: "hr" },
  });
  indexEvidence(
    ctx,
    { objectType: "OnboardingCase", objectId: onboardingCase.id },
    "Equipment ordered. Background check pending. Payroll form missing.",
  );
}
