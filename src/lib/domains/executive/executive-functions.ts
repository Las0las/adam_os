// Phase 4 EXECUTIVE / COMMERCIAL OPS — account-risk briefing reasoning function.
// Grounds a risk brief on ontology + retrieved evidence, runs deterministic risk
// checks, computes a clamped risk score, and fails closed when the account is
// missing. Self-registers on import.

import { z } from "zod";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { validateOutput } from "@/lib/domains/domain-workflow-types";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { RetrievalHit, OntologyObject } from "@/types/dataops";

const topRiskSchema = z.object({
  riskType: z.string(),
  severity: z.string(),
  rationale: z.string(),
  evidenceRefs: z.array(z.string()),
});

const recommendedActionSchema = z.object({
  actionKey: z.string(),
  label: z.string(),
  rationale: z.string(),
  requiresApproval: z.boolean(),
});

const accountRiskBriefOutputSchema = z.object({
  summary: z.string(),
  riskScore: z.number(),
  topRisks: z.array(topRiskSchema),
  recommendedActions: z.array(recommendedActionSchema),
});

export type AccountRiskBriefOutput = z.infer<typeof accountRiskBriefOutputSchema>;

interface AccountRiskBriefInput {
  accountId: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function propStr(obj: OntologyObject, key: string): string | null {
  const v = obj.properties[key];
  return v == null ? null : String(v);
}

const accountRiskBrief: LawrenceFunction<AccountRiskBriefInput, AccountRiskBriefOutput> = {
  key: "executive.account_risk_brief",
  name: "Account risk brief",
  description:
    "Reason over an account's opportunities and risk signals, grounded on evidence, to produce a risk brief, score, and recommended actions.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      riskScore: { type: "number" },
      topRisks: { type: "array", items: { type: "object" } },
      recommendedActions: { type: "array", items: { type: "object" } },
    },
    required: ["summary", "riskScore", "topRisks", "recommendedActions"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<AccountRiskBriefOutput>> {
    const accountId = String(input.accountId);

    // Fail closed: the account must exist.
    const accounts = await listObjects(ctx, "Account");
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("missing account");

    const accountKey = account.externalKey ?? accountId;

    const opps = (await listObjects(ctx, "Opportunity")).filter(
      (o) => propStr(o, "accountId") === accountKey || propStr(o, "accountId") === accountId,
    );
    const risks = (await listObjects(ctx, "RiskSignal")).filter(
      (r) => propStr(r, "objectId") === accountId || propStr(r, "accountId") === accountId ||
        propStr(r, "objectId") === accountKey || propStr(r, "accountId") === accountKey,
    );

    const { hits } = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: "margin delivery risk rate pressure",
      objectTypes: ["Account", "Opportunity", "RiskSignal"],
      subjectObjectId: accountId,
      methods: ["rank_fusion"],
      limit: 8,
    });

    const evidenceRefs = hits.map((h: RetrievalHit) => h.chunkId ?? h.objectId);

    // ── Deterministic risk checks ──────────────────────────────────────
    const topRisks: AccountRiskBriefOutput["topRisks"] = [];

    // 1) High/critical severity risk signals.
    const highRisks = risks.filter((r) => {
      const sev = (propStr(r, "severity") ?? "").toLowerCase();
      return sev === "high" || sev === "critical";
    });
    for (const r of highRisks) {
      topRisks.push({
        riskType: propStr(r, "riskType") ?? "risk",
        severity: (propStr(r, "severity") ?? "high").toLowerCase(),
        rationale: `Risk signal "${r.title ?? r.id}" flagged at ${propStr(r, "severity") ?? "high"} severity.`,
        evidenceRefs,
      });
    }

    // 2) Aged open opportunity (no close) -> delivery risk.
    const agedOpenOpps = opps.filter((o) => {
      const status = (o.status ?? "").toLowerCase();
      const closeDate = propStr(o, "closeDate") ?? propStr(o, "close");
      return !closeDate && status !== "closed" && status !== "won" && status !== "lost";
    });
    if (agedOpenOpps.length > 0) {
      const o = agedOpenOpps[0]!;
      topRisks.push({
        riskType: "delivery",
        severity: "medium",
        rationale: `Open opportunity "${o.title ?? o.id}" has no close date — delivery risk.`,
        evidenceRefs,
      });
    }

    // 3) Missing owner -> risk.
    const owner = propStr(account, "ownerId") ?? propStr(account, "owner");
    if (!owner) {
      topRisks.push({
        riskType: "ownership",
        severity: "medium",
        rationale: `Account "${account.title ?? accountId}" has no assigned owner.`,
        evidenceRefs,
      });
    }

    // Risk score: weighted by number of high-severity risks + evidence presence.
    const rawScore = 0.25 * highRisks.length + (hits.length > 0 ? 0.2 : 0) + 0.1 * agedOpenOpps.length;
    const riskScore = clamp01(rawScore);

    const summary = topRisks.length
      ? `Account "${account.title ?? accountId}" shows ${topRisks.length} active risk(s): ${topRisks
          .map((t) => `${t.riskType} (${t.severity})`)
          .join(", ")}. Grounded on ${hits.length} evidence excerpt(s).`
      : `No material risks detected for account "${account.title ?? accountId}".`;

    const recommendedActions: AccountRiskBriefOutput["recommendedActions"] = [
      {
        actionKey: "executive.create_decision_memo",
        label: "Create decision memo",
        rationale: topRisks.length
          ? "Document the identified risks and recommended mitigations for executive review."
          : "Record the cleared risk assessment for the account.",
        requiresApproval: false,
      },
    ];

    const output: AccountRiskBriefOutput = {
      summary,
      riskScore,
      topRisks,
      recommendedActions,
    };
    const validated = validateOutput(accountRiskBriefOutputSchema, output, accountRiskBrief.key);
    return { output: validated, citations: hits };
  },
};

registerFunction(accountRiskBrief);

export { accountRiskBrief, accountRiskBriefOutputSchema };
