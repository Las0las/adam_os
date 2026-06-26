// Inference Execution Pipeline (Milestone 4.0). One standardized lifecycle:
// context → before hooks → provider → after/failed hooks → normalized result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import {
  registerExecutionHook,
  clearExecutionHooks,
} from "@/lib/aiops/execution/execution-hooks";
import type { ExecutionHook, InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

const OK: CompletionResponse = {
  text: "hello",
  json: null,
  promptTokens: 5,
  completionTokens: 3,
  latencyMs: 1,
  costUsd: 0.01,
  provider: "p",
  modelKey: "m",
};

function descriptor(): ModelDescriptor {
  return {
    provider: "p",
    publisher: "acme",
    family: "fam",
    model: "m",
    version: null,
    contextWindow: 128_000,
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: false,
    supportsJSON: false,
    supportsReasoning: false,
    supportsEmbeddings: false,
    pricing: null,
    deprecated: false,
  };
}

function registryWith(complete: ModelProvider["complete"], requiredEnv: string[][] = []): ProviderRegistry {
  const r = createProviderRegistry();
  const adapter: ModelProvider = { provider: "p", modelKey: "m", complete };
  r.register(
    defineProvider({
      metadata: { id: "p", vendor: "p", displayName: "p", authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
      descriptors: [descriptor()],
      requiredEnv,
      defaultPriority: 10,
      create: () => adapter,
      createDefault: () => adapter,
    }),
  );
  return r;
}

function decision(provider: string | null, model: string | null): RoutingDecision {
  return {
    selectedProvider: provider,
    selectedModel: model,
    evaluatedProviders: provider ? [provider] : [],
    rejectionReasons: [],
    policySnapshot: {},
  };
}

function params(registry: ProviderRegistry, provider: string | null = "p", model: string | null = "m") {
  return {
    request: { prompt: "hi" },
    routingDecision: decision(provider, model),
    registry,
    requestId: "req-1",
    tenantId: "tnt",
    workloadType: "chat",
  };
}

test("successful execution returns a normalized result", async () => {
  resetClock();
  const res = await executeInference(params(registryWith(async () => OK)), []);
  assert.equal(res.success, true);
  assert.equal(res.response, "hello");
  assert.equal(res.json, null);
  assert.equal(res.usage?.promptTokens, 5);
  assert.equal(res.usage?.costUsd, 0.01);
  assert.equal(res.provider, "p");
  assert.equal(res.model, "m");
  assert.equal(res.finishReason, "stop");
  assert.equal(res.error, null);
  assert.ok(res.executionId);
});

test("failed execution is normalized and never throws", async () => {
  const res = await executeInference(
    params(registryWith(async () => { throw new Error("429 rate limit exceeded"); })),
    [],
  );
  assert.equal(res.success, false);
  assert.equal(res.response, null);
  assert.equal(res.error?.kind, "rate_limit");
});

test("a missing provider credential normalizes to an authentication error", async () => {
  const res = await executeInference(params(registryWith(async () => OK, [["MISSING_KEY"]])), []);
  assert.equal(res.success, false);
  assert.equal(res.error?.kind, "authentication");
});

test("an empty routing decision fails before invoking any provider", async () => {
  let failedKind: string | undefined;
  const hook: ExecutionHook = { name: "h", executionFailed: (_c, e) => { failedKind = e.kind; } };
  const res = await executeInference(params(registryWith(async () => OK), null, null), [hook]);
  assert.equal(res.success, false);
  assert.equal(res.error?.kind, "execution_failed");
  assert.equal(failedKind, "execution_failed");
});

test("beforeExecute and afterExecute hooks fire on success", async () => {
  let beforeProvider: string | undefined;
  let afterSuccess: boolean | undefined;
  const hook: ExecutionHook = {
    name: "h",
    beforeExecute: (ctx) => { beforeProvider = ctx.provider; },
    afterExecute: (_ctx, result) => { afterSuccess = result.success; },
  };
  await executeInference(params(registryWith(async () => OK)), [hook]);
  assert.equal(beforeProvider, "p");
  assert.equal(afterSuccess, true);
});

test("executionFailed fires on failure; afterExecute does not", async () => {
  let failedKind: string | undefined;
  let afterCalled = false;
  const hook: ExecutionHook = {
    name: "h",
    executionFailed: (_c, e) => { failedKind = e.kind; },
    afterExecute: () => { afterCalled = true; },
  };
  await executeInference(
    params(registryWith(async () => { throw new Error("timed out"); })),
    [hook],
  );
  assert.equal(failedKind, "timeout");
  assert.equal(afterCalled, false);
});

test("the execution context is immutable", async () => {
  let captured: InferenceExecutionContext | undefined;
  const hook: ExecutionHook = { name: "h", beforeExecute: (ctx) => { captured = ctx; } };
  await executeInference(params(registryWith(async () => OK)), [hook]);
  assert.ok(captured);
  assert.equal(Object.isFrozen(captured), true);
  assert.throws(() => { (captured as { provider: string }).provider = "x"; }, TypeError);
});

test("hooks run in deterministic registration order around provider execution", async () => {
  const seq: string[] = [];
  const mk = (n: number): ExecutionHook => ({
    name: `h${n}`,
    beforeExecute: () => { seq.push(`before:${n}`); },
    afterExecute: () => { seq.push(`after:${n}`); },
  });
  const reg = registryWith(async () => { seq.push("provider"); return OK; });
  await executeInference(params(reg), [mk(1), mk(2), mk(3)]);
  assert.deepEqual(seq, ["before:1", "before:2", "before:3", "provider", "after:1", "after:2", "after:3"]);
});

test("the global hook registry is used when no explicit hooks are passed", async () => {
  clearExecutionHooks();
  let called = false;
  registerExecutionHook({ name: "g", beforeExecute: () => { called = true; } });
  try {
    await executeInference(params(registryWith(async () => OK)));
    assert.equal(called, true);
  } finally {
    clearExecutionHooks();
  }
});
