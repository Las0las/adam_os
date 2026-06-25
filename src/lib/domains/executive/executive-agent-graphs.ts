// Phase 4 EXECUTIVE / COMMERCIAL OPS — commercial risk monitor agent (v2). Wires
// retrieval -> account-risk reasoning -> decision-memo action -> condition ->
// review/notify -> output. The workflow service orchestrates this path directly;
// this definition is the declarative graph surfaced in Studio/seed.

import { now } from "@/lib/lawrence-core/utils/ids";
import type { AgentDefinition } from "@/types/aiops";

export function commercialRiskMonitorAgentV2(tenantId: string): AgentDefinition {
  return {
    id: "agent_executive_commercial_risk_monitor_v2",
    tenantId,
    key: "executive.commercial_risk_monitor",
    name: "Commercial risk monitor (v2)",
    description:
      "Retrieve account context, reason about commercial risk, draft a decision memo, and route high-risk accounts to review.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        {
          id: "retrieve",
          kind: "retrieve",
          config: {
            objectTypes: ["Account", "Opportunity", "RiskSignal"],
            methods: ["rank_fusion"],
          },
        },
        {
          id: "brief",
          kind: "function",
          config: { functionKey: "executive.account_risk_brief", input: {} },
        },
        {
          id: "memo",
          kind: "action",
          config: { actionKey: "executive.create_decision_memo", input: {} },
        },
        {
          id: "decide",
          kind: "condition",
          config: { expression: "output.riskScore >= 0.75" },
        },
        {
          id: "review",
          kind: "review",
          config: {
            caseType: "executive.risk.high",
            severity: "high",
            summary: "Account risk needs executive review",
          },
        },
        { id: "notify", kind: "notify", config: { eventKey: "executive.decision_memo.created" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "brief" },
        { from: "brief", to: "memo" },
        { from: "memo", to: "decide" },
        { from: "decide", to: "review", condition: "true" },
        { from: "decide", to: "notify", condition: "false" },
        { from: "review", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}
