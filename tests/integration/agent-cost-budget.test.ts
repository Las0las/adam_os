// Agent dollar budget (§30). A run whose accumulated model cost exceeds
// maxCostUsd fails through the normal failure path; one within budget completes.
// A test function records a fixed model cost to exercise the meter end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { runAgent } from "@/lib/aiops/agents/agent-runner";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { recordModelCost } from "@/lib/aiops/models/cost-meter";
import type { AgentDefinition, AgentNode, AgentEdge } from "@/types/aiops";

// A function whose "model call" costs $0.60. Registered once for the suite.
registerFunction({
  key: "test_costly_fn",
  name: "Costly Test Function",
  description: "Records a fixed model cost for budget tests.",
  klass: "reason",
  outputSchema: {},
  async run() {
    recordModelCost(0.6);
    return { output: {} };
  },
});

function agentDef(nodes: AgentNode[], edges: AgentEdge[]): AgentDefinition {
  return {
    id: "a1",
    tenantId: "tnt_cost",
    key: "cost_agent",
    name: "Cost Budget Agent",
    graph: { nodes, edges },
    status: "active",
    createdAt: "t",
  };
}

const ctx = systemActor("tnt_cost");
const NODES: AgentNode[] = [
  { id: "in", kind: "input", config: {} },
  { id: "fn", kind: "function", config: { functionKey: "test_costly_fn" } },
  { id: "out", kind: "output", config: {} },
];
const EDGES: AgentEdge[] = [
  { from: "in", to: "fn" },
  { from: "fn", to: "out" },
];

test("agent exceeding the dollar budget fails", async () => {
  await resetDatabase();
  const run = await runAgent(ctx, agentDef(NODES, EDGES), {}, { maxCostUsd: 0.1 });
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /cost budget/);
});

test("agent within the dollar budget completes", async () => {
  await resetDatabase();
  const run = await runAgent(ctx, agentDef(NODES, EDGES), {}, { maxCostUsd: 10 });
  assert.equal(run.status, "completed");
});
