// Architecture conformance for the IOS-004 v1.1 provider-invocation extension
// point (ADR-0003). Proves the general `aroundInvoke` seam is additive and
// deterministic: no middleware = the prior pipeline; a pass-through middleware is
// identical to none; multiple middleware compose as a deterministic onion in
// priority + registration order; and it does not run on a cache hit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { registerExecutionHook, clearExecutionHooks } from "@/lib/aiops/execution/execution-hooks";
import type { ExecutionHook } from "@/lib/aiops/execution/execution-types";

const OK: CompletionResponse = {
  text: "hello", json: null, promptTokens: 5, completionTokens: 3,
  latencyMs: 1, costUsd: 0.01, provider: "p", modelKey: "m",
};

function descriptor(): ModelDescriptor {
  return {
    provider: "p", publisher: "acme", family: "fam", model: "m", version: null,
    contextWindow: 128_000, supportsVision: false, supportsTools: false,
    supportsStreaming: false, supportsJSON: false, supportsReasoning: false,
    supportsEmbeddings: false, pricing: null, deprecated: false,
  };
}
function registryWith(complete: ModelProvider["complete"]): ProviderRegistry {
  const r = createProviderRegistry();
  const adapter: ModelProvider = { provider: "p", modelKey: "m", complete };
  r.register(defineProvider({
    metadata: { id: "p", vendor: "p", displayName: "p", authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
    descriptors: [descriptor()], requiredEnv: [], defaultPriority: 10,
    create: () => adapter, createDefault: () => adapter,
  }));
  return r;
}
const echo: ModelProvider["complete"] = async (req) => ({ ...OK, text: `r:${req.prompt}` });
function counting() {
  let n = 0;
  const reg = registryWith(async (req) => { n += 1; return echo(req); });
  return { reg, calls: () => n };
}
function decision(): RoutingDecision {
  return { selectedProvider: "p", selectedModel: "m", evaluatedProviders: ["p"], rejectionReasons: [], policySnapshot: {} };
}
function params(registry: ProviderRegistry, prompt = "hi") {
  return { request: { prompt }, routingDecision: decision(), registry, requestId: "req", tenantId: "tnt", workloadType: "chat" };
}
function stable(r: Awaited<ReturnType<typeof executeInference>>) {
  return { provider: r.provider, model: r.model, response: r.response, json: r.json, usage: r.usage, finishReason: r.finishReason, success: r.success, error: r.error };
}

test("with no aroundInvoke middleware, the provider is invoked exactly once (prior pipeline)", async () => {
  const { reg, calls } = counting();
  const res = await executeInference(params(reg, "x"), []);
  assert.equal(res.success, true);
  assert.equal(res.response, "r:x");
  assert.equal(calls(), 1);
});

test("a pass-through aroundInvoke middleware yields identical execution to none", async () => {
  const base = counting();
  const bare = await executeInference(params(base.reg, "x"), []);

  const probe = counting();
  const passthrough: ExecutionHook = {
    name: "passthrough",
    aroundInvoke: (req, _ctx, next) => next(req),
  };
  const wrapped = await executeInference(params(probe.reg, "x"), [passthrough]);

  assert.deepEqual(stable(wrapped), stable(bare));
  assert.equal(base.calls(), 1);
  assert.equal(probe.calls(), 1);
});

test("multiple aroundInvoke middleware compose as a deterministic onion (registration order)", async () => {
  const { reg } = counting();
  const order: string[] = [];
  const mk = (name: string): ExecutionHook => ({
    name,
    aroundInvoke: async (req, _ctx, next) => {
      order.push(`>${name}`);
      const r = await next(req);
      order.push(`<${name}`);
      return r;
    },
  });
  await executeInference(params(reg, "x"), [mk("a"), mk("b"), mk("c")]);
  assert.deepEqual(order, [">a", ">b", ">c", "<c", "<b", "<a"]);
});

test("aroundInvoke composition order follows the priority-ordered registry", async () => {
  clearExecutionHooks();
  const { reg } = counting();
  const order: string[] = [];
  const mk = (name: string): ExecutionHook => ({
    name,
    aroundInvoke: async (req, _ctx, next) => { order.push(name); return next(req); },
  });
  // Equal priority (undefined → 0): registration order is the stable tie-break.
  registerExecutionHook(mk("first"));
  registerExecutionHook(mk("second"));
  registerExecutionHook(mk("third"));
  try {
    await executeInference(params(reg, "x")); // default hooks = listExecutionHooks()
    assert.deepEqual(order, ["first", "second", "third"]);
  } finally {
    clearExecutionHooks();
  }
});

test("aroundInvoke does not run when the response is resolved from cache", async () => {
  let aroundCalls = 0;
  let providerCalls = 0;
  const resolver: ExecutionHook = { name: "resolver", resolveCompletion: () => OK }; // short-circuit
  const around: ExecutionHook = {
    name: "around",
    aroundInvoke: (req: CompletionRequest, _ctx, next) => { aroundCalls += 1; return next(req); },
  };
  const reg = registryWith(async () => { providerCalls += 1; return OK; });
  const res = await executeInference(params(reg, "x"), [resolver, around]);
  assert.equal(res.success, true);
  assert.equal(res.response, "hello");
  assert.equal(aroundCalls, 0, "no provider call → aroundInvoke is skipped");
  assert.equal(providerCalls, 0);
});
