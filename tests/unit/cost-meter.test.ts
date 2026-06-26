// Per-run model cost meter + provider wiring (drives the agent dollar budget).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithCostMeter, recordModelCost, currentCostMeter } from "@/lib/aiops/models/cost-meter";
import {
  getModelProvider,
  setModelProvider,
  MockModelProvider,
  type ModelProvider,
} from "@/lib/aiops/models/model-provider";

test("recordModelCost accumulates within a meter scope", () => {
  const total = runWithCostMeter((m) => {
    recordModelCost(0.2);
    recordModelCost(0.3);
    return m.totalCostUsd;
  });
  assert.equal(Number(total.toFixed(2)), 0.5);
});

test("recordModelCost counts calls even at zero cost", () => {
  const calls = runWithCostMeter((m) => {
    recordModelCost(0);
    recordModelCost(0);
    return m.calls;
  });
  assert.equal(calls, 2);
});

test("recording outside a meter is a no-op and currentCostMeter is null", () => {
  recordModelCost(5);
  assert.equal(currentCostMeter(), null);
});

test("meters are isolated between scopes", () => {
  const a = runWithCostMeter((m) => {
    recordModelCost(1);
    return m.totalCostUsd;
  });
  const b = runWithCostMeter((m) => {
    recordModelCost(2);
    return m.totalCostUsd;
  });
  assert.equal(a, 1);
  assert.equal(b, 2);
});

test("getModelProvider records each completion's cost into the active meter", async () => {
  const stub: ModelProvider = {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return {
        text: "x",
        promptTokens: 1,
        completionTokens: 1,
        latencyMs: 1,
        costUsd: 0.3,
        provider: "stub",
        modelKey: "stub-1",
      };
    },
  };
  setModelProvider(stub);
  try {
    const total = await runWithCostMeter(async (m) => {
      await getModelProvider().complete({ prompt: "hi" });
      await getModelProvider().complete({ prompt: "again" });
      return m.totalCostUsd;
    });
    assert.equal(Number(total.toFixed(2)), 0.6);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});
