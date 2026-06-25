// Recruiting seed pack (§49). Registers a customer-affecting action (advance a
// candidate's stage) that requires approval, and a shortlist-builder agent.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition } from "@/types/aiops";

// Action: advancing a candidate stage affects a person -> requires approval.
registerAction({
  key: "advance_candidate_stage",
  requiredPermission: "review.reviewer",
  requiresApproval: true,
  precondition(_ctx, input) {
    const valid = ["screen", "submitted", "interview", "offer", "placed", "rejected"];
    return valid.includes(String(input.toStage)) ? null : `invalid stage: ${input.toStage}`;
  },
  async run(ctx: ActorContext, input) {
    const obj = db.ontologyObjects.get(ctx.tenantId, String(input.candidateId));
    if (!obj) throw new Error(`Candidate not found: ${input.candidateId}`);
    const updated = db.ontologyObjects.update(obj.id, {
      status: String(input.toStage),
      updatedAt: now(),
    });
    return { candidateId: updated.id, stage: updated.status };
  },
});

// Function: explain why a candidate is shortlisted, grounded on their evidence.
const explainShortlist: LawrenceFunction<{ candidateId: string; jobTitle: string }, { rationale: string }> = {
  key: "explain_shortlist",
  name: "Explain shortlist",
  description: "Explain why a candidate fits a job, grounded on their evidence chunks.",
  klass: "reason",
  outputSchema: { type: "object", properties: { rationale: { type: "string" } }, required: ["rationale"] },
  async run(ctx, input): Promise<FunctionExecutionResult<{ rationale: string }>> {
    const chunks = db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === input.candidateId);
    const evidence = chunks.map((c) => c.text).join(" ").slice(0, 600);
    return {
      output: {
        rationale: `Candidate matched for ${input.jobTitle} based on: ${evidence || "profile properties"}`,
      },
    };
  },
};
registerFunction(explainShortlist);

/** A shortlist-builder agent definition (§49 agents). */
export function shortlistBuilderAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_shortlist_builder",
    tenantId,
    key: "shortlist_builder",
    name: "Shortlist builder",
    description: "Retrieve candidate evidence, explain fit, and open a review for the shortlist.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        { id: "retrieve", kind: "retrieve", config: { objectTypes: ["Candidate"], methods: ["rank_fusion"] } },
        { id: "explain", kind: "function", config: { functionKey: "summarize_object", input: {} } },
        { id: "review", kind: "review", config: { caseType: "shortlist_review", summary: "Review proposed shortlist", severity: "low" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "explain" },
        { from: "explain", to: "review" },
        { from: "review", to: "out" },
      ],
    },
  };
}
