// Phase 4 CLAIMS — claim-validation agent (v2). Wires input -> retrieval -> the
// evidence-summary reasoning function -> the create-finding action -> a
// condition -> review/notify -> output. The workflow service orchestrates this
// path directly; this declarative graph is what is surfaced in Studio/seed.

import { now } from "@/lib/lawrence-core/utils/ids";
import type { AgentDefinition } from "@/types/aiops";

export function claimValidationAgentV2(tenantId: string): AgentDefinition {
  return {
    id: "agent_claims_validation_v2",
    tenantId,
    key: "claims.validation_agent",
    name: "Claim validation agent (v2)",
    description:
      "Retrieve claim evidence, reason over it, write findings through the action engine, and route high-severity findings to review.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        {
          id: "retrieve",
          kind: "retrieve",
          config: {
            objectTypes: ["ValidationCase", "ClaimDocument", "EmailMessage"],
            methods: ["rank_fusion"],
          },
        },
        {
          id: "summarize",
          kind: "function",
          config: { functionKey: "claims.validation_case_evidence_summary", input: {} },
        },
        {
          id: "record",
          kind: "action",
          config: { actionKey: "claims.create_validation_finding", input: {} },
        },
        {
          id: "decide",
          kind: "condition",
          config: { expression: "output.recommendedDisposition === 'needs_human_review'" },
        },
        {
          id: "review",
          kind: "review",
          config: {
            caseType: "claims.case.needs_review",
            severity: "high",
            summary: "Validation findings require review",
          },
        },
        { id: "notify", kind: "notify", config: { eventKey: "claims.finding.critical" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "summarize" },
        { from: "summarize", to: "record" },
        { from: "record", to: "decide" },
        { from: "decide", to: "review", condition: "true" },
        { from: "decide", to: "notify", condition: "false" },
        { from: "review", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}
