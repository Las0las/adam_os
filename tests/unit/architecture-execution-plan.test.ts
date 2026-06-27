// Architecture conformance for the IOS-004 v1.2 Execution Plan (ADR-0004). Proves
// the routing/execution boundary: routing owns the immutable, authorized plan;
// execution invokes ONLY plan members; middleware may select among plan targets
// but cannot invent/authorize/mutate them. With no override execution is
// byte-for-byte identical; a valid plan target is invoked deterministically; a
// target absent from the plan is rejected (no provider call); routing is never
// re-executed and the RoutingDecision/plan is never mutated; overrides thread
// through inner middleware while composition order is preserved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import { deepFreeze, type ExecutionTarget, type RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { buildExecutionPlan, planContains, primaryTarget } from "@/lib/aiops/routing/execution-plan";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import type { ExecutionHook } from "@/lib/aiops/execution/execution-types";

const OK: CompletionResponse = {
  text: "hello", json: null, promptTokens: 5, completionTokens: 3,
  latencyMs: 1, costUsd: 0.01, provider: "p", modelKey: "m",
};

function descriptor(provider: string, model: string): ModelDescriptor {
  return {
    provider, publisher: "acme", family: "fam", model, version: null,
    contextWindow: 128_000, supportsVision: false, supportsTools: false,
    supportsStreaming: false, supportsJSON: false, supportsReasoning: false,
    supportsEmbeddings: false, pricing: null, deprecated: false,
  };
}
interface Spec { id: string; model: string; complete: ModelProvider["complete"] }
function multiRegistry(specs: Spec[]): { reg: ProviderRegistry; calls: Record<string, number> } {
  const reg = createProviderRegistry();
  const calls: Record<string, number> = {};
  for (const s of specs) {
    calls[s.id] = 0;
    const adapter: ModelProvider = {
      provider: s.id, modelKey: s.model,
      complete: async (req) => { calls[s.id] = (calls[s.id] ?? 0) + 1; return s.complete(req); },
    };
    reg.register(defineProvider({
      metadata: { id: s.id, vendor: s.id, displayName: s.id, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
      descriptors: [descriptor(s.id, s.model)], requiredEnv: [], defaultPriority: 10,
      create: () => adapter, createDefault: () => adapter,
    }));
  }
  return { reg, calls };
}
const echo = (tag: string): ModelProvider["complete"] => async (req) => ({ ...OK, text: `${tag}:${req.prompt}` });

/** p (primary) + p2 (authorized plan alternate) + p3 (NOT in the plan). */
function fixture() {
  return multiRegistry([
    { id: "p", model: "m", complete: echo("p") },
    { id: "p2", model: "m2", complete: echo("p2") },
    { id: "p3", model: "m3", complete: echo("p3") },
  ]);
}
function decision(): RoutingDecision {
  // Routing authorized a plan of [p, p2]; p3 is absent from the plan.
  return deepFreeze({
    selectedProvider: "p", selectedModel: "m",
    evaluatedProviders: ["p", "p2"], rejectionReasons: [], policySnapshot: {},
    executionPlan: { targets: [{ provider: "p", model: "m" }, { provider: "p2", model: "m2" }] },
  });
}
function params(reg: ProviderRegistry, d: RoutingDecision, prompt = "x") {
  return { request: { prompt }, routingDecision: d, registry: reg, requestId: "req", tenantId: "tnt", workloadType: "chat" };
}
function stable(r: Awaited<ReturnType<typeof executeInference>>) {
  return { response: r.response, json: r.json, usage: r.usage, finishReason: r.finishReason, success: r.success, error: r.error };
}
const retarget = (target: ExecutionTarget): ExecutionHook => ({ name: "retarget", aroundInvoke: (req, _ctx, next) => next(req, target) });

// ── buildExecutionPlan / membership ──────────────────────────────────────────

test("buildExecutionPlan returns the routing-supplied plan, else the single selected target", () => {
  const withPlan = buildExecutionPlan(decision());
  assert.deepEqual(withPlan.targets.map((t) => `${t.provider}|${t.model}`), ["p|m", "p2|m2"]);
  assert.deepEqual(primaryTarget(withPlan), { provider: "p", model: "m" });

  const noPlan = buildExecutionPlan(deepFreeze({
    selectedProvider: "x", selectedModel: "y", evaluatedProviders: ["x"], rejectionReasons: [], policySnapshot: {},
  }));
  assert.deepEqual(noPlan.targets, [{ provider: "x", model: "y" }]);
  assert.equal(planContains(noPlan, { provider: "x", model: "y" }), true);
  assert.equal(planContains(noPlan, { provider: "z", model: "y" }), false);
});

// ── No override → byte-for-byte identical ────────────────────────────────────

test("with no override, execution is identical to the prior pipeline", async () => {
  const a = fixture();
  const bare = await executeInference(params(a.reg, decision()), []);
  const b = fixture();
  const passthrough: ExecutionHook = { name: "passthrough", aroundInvoke: (req, _c, next) => next(req) };
  const wrapped = await executeInference(params(b.reg, decision()), [passthrough]);

  assert.equal(bare.response, "p:x");
  assert.deepEqual(stable(wrapped), stable(bare));
  assert.equal(a.calls.p, 1);
  assert.equal(b.calls.p, 1);
  assert.equal(b.calls.p2, 0, "no alternate touched without an override");
});

// ── Valid plan target → invoked deterministically ────────────────────────────

test("a valid override (a plan member) invokes that alternate target", async () => {
  const f = fixture();
  const res = await executeInference(params(f.reg, decision()), [retarget({ provider: "p2", model: "m2" })]);
  assert.equal(res.success, true);
  assert.equal(res.response, "p2:x");
  assert.equal(f.calls.p, 0, "primary not invoked");
  assert.equal(f.calls.p2, 1, "the plan alternate was invoked once");
  assert.equal(res.provider, "p", "routing identity preserved (override only redirects invocation)");
  assert.equal(res.model, "m");
});

test("override selection is deterministic across repeated executions", async () => {
  for (let i = 0; i < 3; i++) {
    const f = fixture();
    const res = await executeInference(params(f.reg, decision()), [retarget({ provider: "p2", model: "m2" })]);
    assert.equal(res.response, "p2:x");
    assert.equal(f.calls.p2, 1);
  }
});

// ── Target absent from the plan → rejected ───────────────────────────────────

test("an override not contained in the execution plan is rejected (no provider call)", async () => {
  const f = fixture();
  // p3 is not in the plan → the pipeline rejects it, even though it is registered.
  const res = await executeInference(params(f.reg, decision()), [retarget({ provider: "p3", model: "m3" })]);
  assert.equal(res.success, false);
  assert.equal(res.error?.kind, "provider_unavailable");
  assert.equal(f.calls.p3, 0, "a non-plan target is never invoked");
  assert.equal(f.calls.p, 0);
});

// ── Routing not re-executed; plan immutable ──────────────────────────────────

test("the RoutingDecision and its execution plan are never mutated by an override", async () => {
  const f = fixture();
  const d = decision();
  const snapshot = JSON.parse(JSON.stringify(d));
  await executeInference(params(f.reg, d), [retarget({ provider: "p2", model: "m2" })]);
  assert.ok(Object.isFrozen(d), "RoutingDecision stays frozen");
  assert.ok(Object.isFrozen(d.executionPlan), "execution plan stays frozen");
  assert.deepEqual(JSON.parse(JSON.stringify(d)), snapshot, "byte-for-byte unchanged");
});

// ── Threading through inner middleware; ordering preserved ────────────────────

test("an outer override threads through inner middleware to the provider; order preserved", async () => {
  const f = fixture();
  const order: string[] = [];
  const outer: ExecutionHook = {
    name: "outer", priority: 1,
    aroundInvoke: async (req, _c, next) => { order.push(">outer"); const r = await next(req, { provider: "p2", model: "m2" }); order.push("<outer"); return r; },
  };
  const inner: ExecutionHook = {
    name: "inner", priority: 2,
    aroundInvoke: async (req, _c, next) => { order.push(">inner"); const r = await next(req); order.push("<inner"); return r; },
  };
  const res = await executeInference(params(f.reg, decision()), [outer, inner]);
  assert.equal(res.response, "p2:x", "the inner middleware's target-less next inherited the outer override");
  assert.equal(f.calls.p2, 1);
  assert.equal(f.calls.p, 0);
  assert.deepEqual(order, [">outer", ">inner", "<inner", "<outer"], "onion order preserved");
});

test("an inner override takes precedence over an inherited outer target", async () => {
  const f = fixture();
  const outer: ExecutionHook = { name: "outer", priority: 1, aroundInvoke: (req, _c, next) => next(req, { provider: "p2", model: "m2" }) };
  const inner: ExecutionHook = { name: "inner", priority: 2, aroundInvoke: (req, _c, next) => next(req, { provider: "p", model: "m" }) };
  const res = await executeInference(params(f.reg, decision()), [outer, inner]);
  assert.equal(res.response, "p:x", "the inner middleware's explicit target wins (thisTarget ?? outerTarget)");
  assert.equal(f.calls.p, 1);
  assert.equal(f.calls.p2, 0);
});
