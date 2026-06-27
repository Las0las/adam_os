// Architecture conformance for the IOS-004 v1.2 Invocation Target Override
// (ADR-0004). Proves the general capability is additive and routing stays
// authoritative: with no override execution is byte-for-byte identical; a valid
// override invokes the alternate AUTHORIZED target deterministically; an
// unauthorized override is rejected by the pipeline (no provider call); routing
// is never re-executed and the RoutingDecision is never mutated; and target
// overrides thread through inner middleware while composition order is preserved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import type { ExecutionHook } from "@/lib/aiops/execution/execution-types";
import type { InvocationTarget } from "@/lib/aiops/execution/invocation-target";

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

/** Registry with multiple providers; each provider's adapter labels itself. */
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

/** p (primary) + p2 (authorized alternate) + p3 (NOT evaluated → unauthorized). */
function fixture() {
  return multiRegistry([
    { id: "p", model: "m", complete: echo("p") },
    { id: "p2", model: "m2", complete: echo("p2") },
    { id: "p3", model: "m3", complete: echo("p3") },
  ]);
}
function decision(): RoutingDecision {
  // Routing evaluated p and p2 (authorizing both); p3 was never evaluated.
  return deepFreeze({
    selectedProvider: "p", selectedModel: "m",
    evaluatedProviders: ["p", "p2"], rejectionReasons: [], policySnapshot: {},
  });
}
function params(reg: ProviderRegistry, routingDecision: RoutingDecision, prompt = "x") {
  return { request: { prompt }, routingDecision, registry: reg, requestId: "req", tenantId: "tnt", workloadType: "chat" };
}
function stable(r: Awaited<ReturnType<typeof executeInference>>) {
  return { response: r.response, json: r.json, usage: r.usage, finishReason: r.finishReason, success: r.success, error: r.error };
}
const retarget = (target: InvocationTarget): ExecutionHook => ({ name: "retarget", aroundInvoke: (req, _ctx, next) => next(req, target) });

// ── No override → byte-for-byte identical ────────────────────────────────────

test("with no invocation target override, execution is identical to the prior pipeline", async () => {
  const a = fixture();
  const bare = await executeInference(params(a.reg, decision()), []);
  const b = fixture();
  const passthrough: ExecutionHook = { name: "passthrough", aroundInvoke: (req, _c, next) => next(req) };
  const wrapped = await executeInference(params(b.reg, decision()), [passthrough]);

  assert.equal(bare.response, "p:x");
  assert.deepEqual(stable(wrapped), stable(bare));
  assert.equal(a.calls.p, 1);
  assert.equal(b.calls.p, 1);
  assert.equal(b.calls.p2, 0, "the alternate is never touched without an override");
});

// ── Valid override → alternate authorized target invoked deterministically ───

test("a valid override invokes the alternate authorized target (provider not re-routed)", async () => {
  const f = fixture();
  const res = await executeInference(params(f.reg, decision()), [retarget({ provider: "p2", model: "m2" })]);
  assert.equal(res.success, true);
  assert.equal(res.response, "p2:x", "the alternate authorized provider answered");
  assert.equal(f.calls.p, 0, "the primary was not invoked");
  assert.equal(f.calls.p2, 1, "the alternate was invoked exactly once");
  // The result still reports the routing-selected provider/model in ctx-derived
  // fields (routing identity is preserved; the override only redirects invocation).
  assert.equal(res.provider, "p");
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

// ── Unauthorized override → rejected by the pipeline ─────────────────────────

test("an override the routing layer did not authorize is rejected (no provider call)", async () => {
  const f = fixture();
  // p3 was never evaluated by routing → not authorized.
  const res = await executeInference(params(f.reg, decision()), [retarget({ provider: "p3", model: "m3" })]);
  assert.equal(res.success, false);
  assert.equal(res.error?.kind, "provider_unavailable");
  assert.equal(f.calls.p3, 0, "an unauthorized target is never invoked");
  assert.equal(f.calls.p, 0);
});

test("a rejected (provider, model) pair is not an authorized override target", async () => {
  const f = fixture();
  const d = deepFreeze({
    selectedProvider: "p", selectedModel: "m",
    evaluatedProviders: ["p", "p2"],
    rejectionReasons: [{ provider: "p2", model: "m2", reason: "capability" }],
    policySnapshot: {},
  });
  const res = await executeInference(params(f.reg, d), [retarget({ provider: "p2", model: "m2" })]);
  assert.equal(res.success, false);
  assert.equal(res.error?.kind, "provider_unavailable");
  assert.equal(f.calls.p2, 0);
});

// ── Routing not re-executed; RoutingDecision immutable ───────────────────────

test("the RoutingDecision is never mutated by an override and remains frozen", async () => {
  const f = fixture();
  const d = decision();
  const snapshot = JSON.parse(JSON.stringify(d));
  await executeInference(params(f.reg, d), [retarget({ provider: "p2", model: "m2" })]);
  assert.ok(Object.isFrozen(d), "RoutingDecision stays frozen");
  assert.deepEqual(JSON.parse(JSON.stringify(d)), snapshot, "RoutingDecision is byte-for-byte unchanged");
});

// ── Target threads through inner middleware; ordering preserved ───────────────

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
