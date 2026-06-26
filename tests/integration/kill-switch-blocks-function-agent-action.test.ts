// Phase 6 — an enabled kill switch blocks function, agent, and action execution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { runAgent } from "@/lib/aiops/agents/agent-runner";
import { registerAction, executeAction } from "@/lib/mission-control/actions/action-service";
import { enableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-service";
import { RuntimeKilledError } from "@/lib/mission-control/runtime/kill-switch-guard";
import { setupGovernance } from "../helpers/mc-flow";
import type { AgentDefinition } from "@/types/aiops";

registerFunction({
  key: "ks_fn",
  name: "ks fn",
  description: "",
  klass: "summarize",
  outputSchema: {},
  async run() {
    return { output: { ok: true } };
  },
});
registerAction({ key: "ks_action", async run() { return { ok: true }; } });

const ksAgent: AgentDefinition = {
  id: "agt_ks",
  tenantId: "tnt_test",
  key: "ks_agent",
  name: "ks agent",
  graph: { nodes: [{ id: "n1", kind: "output", config: {} }], edges: [] },
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
};

test("kill switch blocks function, agent, and action", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();

  for (const componentKey of ["ks_fn", "ks_agent", "ks_action"]) {
    const componentType = componentKey === "ks_fn" ? "function" : componentKey === "ks_agent" ? "agent" : "action";
    await enableKillSwitch(ctx, {
      componentType: componentType as never,
      componentKey,
      reason: "incident response",
      actorUserId: "usr_admin",
    });
  }

  // Function + agent throw RuntimeKilledError before running.
  await assert.rejects(() => runFunction(ctx, "ks_fn", {}), RuntimeKilledError);
  await assert.rejects(() => runAgent(ctx, ksAgent, {}), RuntimeKilledError);

  // Action returns a blocked execution (not a thrown error).
  const exec = await executeAction(ctx, { actionKey: "ks_action", input: {} });
  assert.equal(exec.status, "blocked");
  assert.match(exec.blockedReason ?? "", /kill switch/);
});
