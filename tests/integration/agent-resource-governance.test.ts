// Agent runtime resource governance (§30). A run is bounded by a wall-clock
// timeout, a step cap, and a model-call budget; a breach fails the run through
// the normal failure path (persisted AgentRun with status "failed").
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { runAgent } from "@/lib/aiops/agents/agent-runner";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import type { AgentDefinition, AgentNode, AgentEdge } from "@/types/aiops";

function agentDef(nodes: AgentNode[], edges: AgentEdge[]): AgentDefinition {
  return {
    id: "a1",
    tenantId: "tnt_gov",
    key: "gov_agent",
    name: "Governance Test Agent",
    graph: { nodes, edges },
    status: "active",
    createdAt: "t",
  };
}

const ctx = systemActor("tnt_gov");

test("a simple graph completes under default limits", async () => {
  await resetDatabase();
  const agent = agentDef(
    [
      { id: "in", kind: "input", config: {} },
      { id: "out", kind: "output", config: {} },
    ],
    [{ from: "in", to: "out" }],
  );
  const run = await runAgent(ctx, agent, {});
  assert.equal(run.status, "completed");
});

test("exceeding the step budget fails the run", async () => {
  await resetDatabase();
  const agent = agentDef(
    [
      { id: "in", kind: "input", config: {} },
      { id: "mid", kind: "condition", config: {} },
      { id: "out", kind: "output", config: {} },
    ],
    [
      { from: "in", to: "mid" },
      { from: "mid", to: "out" },
    ],
  );
  const run = await runAgent(ctx, agent, {}, { maxSteps: 1 });
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /step budget/);
});

test("exceeding the wall-clock timeout fails the run", async () => {
  await resetDatabase();
  const agent = agentDef(
    [
      { id: "in", kind: "input", config: {} },
      { id: "out", kind: "output", config: {} },
    ],
    [{ from: "in", to: "out" }],
  );
  const run = await runAgent(ctx, agent, {}, { timeoutMs: 0 });
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /time budget/);
});

test("exceeding the model-call budget fails before invoking the function", async () => {
  await resetDatabase();
  const agent = agentDef(
    [
      { id: "in", kind: "input", config: {} },
      { id: "fn", kind: "function", config: { functionKey: "never_invoked" } },
      { id: "out", kind: "output", config: {} },
    ],
    [
      { from: "in", to: "fn" },
      { from: "fn", to: "out" },
    ],
  );
  // maxFunctionCalls: 0 → the budget check trips before runFunction is called,
  // so the bogus functionKey is never resolved.
  const run = await runAgent(ctx, agent, {}, { maxFunctionCalls: 0 });
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /model-call budget/);
});
