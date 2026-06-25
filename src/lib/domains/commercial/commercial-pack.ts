// Executive / Commercial Ops seed pack (§53). Registers an Opportunity object
// mapper, account-risk summarization, an executive brief drafter, a margin
// escalation action, and an account-risk monitor agent. Self-registers via
// side-effect imports.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { registerObjectMapper } from "@/lib/dataops/ontology/object-mapper-registry";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { generateDraftResponse } from "@/lib/aiops/functions/builtins/generate-draft-response";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition } from "@/types/aiops";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

// ── Object mapper: Opportunity ──────────────────────────────────────────
registerObjectMapper({
  key: "commercial",
  async map(ctx: ActorContext, record: CanonicalRecord): Promise<OntologyObject[]> {
    const p = record.payload;
    const name = str(p.name);
    const externalKey = str(p.opp_id) ?? name;
    if (!externalKey) return [];
    const opportunity = await upsertObject(ctx, {
      objectType: "Opportunity",
      externalKey,
      title: name ?? externalKey,
      status: str(p.stage),
      properties: {
        name,
        stage: str(p.stage),
        value: p.value ?? null,
      },
    });
    return [opportunity];
  },
});

// ── Function: summarize_account_risk ────────────────────────────────────
const summarizeAccountRisk: LawrenceFunction<{ accountId?: unknown }, { summary: string }> = {
  key: "summarize_account_risk",
  name: "Summarize account risk",
  description: "Summarize risk-signal evidence attached to an account.",
  klass: "summarize",
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  async run(ctx, input): Promise<FunctionExecutionResult<{ summary: string }>> {
    const accountId = String(input.accountId ?? "");
    const chunks = await db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === accountId);
    const evidence = chunks
      .map((c) => c.text)
      .join(" ")
      .slice(0, 600);
    return {
      output: {
        summary: evidence
          ? `Risk summary for account ${accountId}: ${evidence}`
          : `No risk signals found for account ${accountId}.`,
      },
    };
  },
};
registerFunction(summarizeAccountRisk);

// ── Function: generate_executive_brief (delegates to draft built-in) ────
const generateExecutiveBrief: LawrenceFunction<
  { prompt?: unknown },
  { draft: string; citationCount: number }
> = {
  key: "generate_executive_brief",
  name: "Generate executive brief",
  description: "Draft an executive-tone brief grounded on account and opportunity evidence.",
  klass: "draft",
  outputSchema: {
    type: "object",
    properties: { draft: { type: "string" }, citationCount: { type: "number" } },
    required: ["draft", "citationCount"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<{ draft: string; citationCount: number }>> {
    return generateDraftResponse.run(ctx, {
      prompt: String(input.prompt ?? "Executive brief"),
      objectTypes: ["Account", "Opportunity"],
      tone: "executive",
    });
  },
};
registerFunction(generateExecutiveBrief);

// ── Action: escalate_margin_exception (gated by approval) ───────────────
registerAction({
  key: "escalate_margin_exception",
  requiredPermission: "review.reviewer",
  requiresApproval: true,
  precondition(_ctx, input) {
    return input.opportunityId ? null : "missing opportunityId";
  },
  async run(_ctx: ActorContext, input) {
    return { escalated: true, opportunityId: String(input.opportunityId) };
  },
});

/** Account-risk monitor agent: retrieve account context, summarize risk,
 *  evaluate a condition, and escalate margin exceptions. */
export function accountRiskMonitorAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_account_risk_monitor",
    tenantId,
    key: "account_risk_monitor",
    name: "Account risk monitor",
    description: "Monitor account risk signals and escalate margin exceptions.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        { id: "retrieve", kind: "retrieve", config: { objectTypes: ["Account"], methods: ["rank_fusion"] } },
        { id: "summarize", kind: "function", config: { functionKey: "summarize_account_risk", input: {} } },
        { id: "condition", kind: "condition", config: { passthrough: true } },
        { id: "escalate", kind: "action", config: { actionKey: "escalate_margin_exception", input: {} } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "summarize" },
        { from: "summarize", to: "condition" },
        { from: "condition", to: "escalate" },
        { from: "escalate", to: "out" },
      ],
    },
  };
}

/** Seed an Account + Opportunity plus account risk evidence. */
export async function seedCommercial(ctx: ActorContext): Promise<void> {
  const account = await upsertObject(ctx, {
    objectType: "Account",
    externalKey: "acct-1",
    title: "Acme Corp",
    status: "active",
  });
  await upsertObject(ctx, {
    objectType: "Opportunity",
    externalKey: "opp-1",
    title: "Acme renewal",
    status: "negotiation",
    properties: { value: 120000 },
  });
  await indexEvidence(
    ctx,
    { objectType: "Account", objectId: account.id },
    "Margin declined 8 points this quarter due to discounting. Renewal at risk.",
  );
}
