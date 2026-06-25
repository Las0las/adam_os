// Phase 4 RECRUITING — shortlist-builder agent (v2). Wires retrieval -> the
// candidate-fit reasoning function -> a condition -> shortlist action / review
// -> notify -> output. The workflow service orchestrates this path directly;
// this definition is the declarative graph surfaced in Studio/seed.

import { now } from "@/lib/lawrence-core/utils/ids";
import type { AgentDefinition } from "@/types/aiops";

export function shortlistBuilderAgentV2(tenantId: string): AgentDefinition {
  return {
    id: "agent_recruiting_shortlist_builder_v2",
    tenantId,
    key: "recruiting.shortlist_builder",
    name: "Shortlist builder (v2)",
    description:
      "Retrieve candidate + job evidence, reason about fit, and route to shortlist or review.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        {
          id: "retrieve",
          kind: "retrieve",
          config: { objectTypes: ["Candidate", "Job"], methods: ["rank_fusion"] },
        },
        {
          id: "fit",
          kind: "function",
          config: { functionKey: "recruiting.candidate_fit_summary", input: {} },
        },
        {
          id: "decide",
          kind: "condition",
          config: { expression: "output.recommendedNextAction === 'shortlist'" },
        },
        {
          id: "shortlist",
          kind: "action",
          config: { actionKey: "recruiting.shortlist_candidate", input: {} },
        },
        {
          id: "review",
          kind: "review",
          config: {
            caseType: "recruiting.candidate_fit_review",
            severity: "medium",
            summary: "Candidate fit needs review",
          },
        },
        { id: "notify", kind: "notify", config: { eventKey: "recruiting.shortlist.created" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "fit" },
        { from: "fit", to: "decide" },
        { from: "decide", to: "shortlist", condition: "true" },
        { from: "decide", to: "review", condition: "false" },
        { from: "shortlist", to: "notify" },
        { from: "review", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}
