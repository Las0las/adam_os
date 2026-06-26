// Execution Observability (Milestone 5.0). Proves the passive observation layer
// attaches through middleware/hooks and that it changes NOTHING about execution:
// telemetry/audit/health all fire, ordering is by priority, the provider call is
// unchanged, and the normalized result is identical with or without observation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import {
  registerExecutionHook,
  listExecutionHooks,
  clearExecutionHooks,
} from "@/lib/aiops/execution/execution-hooks";
import type { ExecutionHook, InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { MetricsCollector } from "@/lib/aiops/execution/observability/metrics-collector";
import { ExecutionAuditEngine } from "@/lib/aiops/execution/observability/audit-engine";
import { PassiveHealthCollector } from "@/lib/aiops/execution/observability/health-collector";
import {
  listMiddleware,
  registerMiddleware,
  MIDDLEWARE_PRIORITY,
  type ExecutionMiddleware,
} from "@/lib/aiops/execution/observability/execution-middleware";
import {
  installExecutionObservability,
  observability,
} from "@/lib/aiops/execution/observability/observability-bootstrap";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";

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

function registryWith(complete: ModelProvider["complete"]): ProviderRegistry {
  const r = createProviderRegistry();
  const adapter: ModelProvider = { provider: "p", modelKey: "m", complete };
  r.register(
    defineProvider({
      metadata: { id: "p", vendor: "p", displayName: "p", authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
      descriptors: [descriptor()],
      requiredEnv: [],
      defaultPriority: 10,
      create: () => adapter,
      createDefault: () => adapter,
    }),
  );
  return r;
}

function decision(): RoutingDecision {
  return {
    selectedProvider: "p",
    selectedModel: "m",
    evaluatedProviders: ["p"],
    rejectionReasons: [],
    policySnapshot: {},
  };
}

function params(registry: ProviderRegistry, request: CompletionRequest = { prompt: "hi" }) {
  return {
    request,
    routingDecision: decision(),
    registry,
    requestId: "req-1",
    tenantId: "tnt",
    workloadType: "chat",
  };
}

const succeed: ModelProvider["complete"] = async () => OK;
const fail = (message: string): ModelProvider["complete"] => async () => { throw new Error(message); };

// ── Telemetry ─────────────────────────────────────────────────────────────────

test("telemetry captures started + completed events for a success", async () => {
  const t = new ExecutionTelemetryEngine();
  await executeInference(params(registryWith(succeed)), [t]);
  const events = t.events();
  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "execution.started");
  assert.equal(events[1]?.type, "execution.completed");
  const completed = events[1];
  assert.ok(completed && completed.type === "execution.completed");
  assert.equal(completed.provider, "p");
  assert.equal(completed.model, "m");
  assert.equal(completed.workloadType, "chat");
  assert.equal(completed.tenantId, "tnt");
  assert.equal(completed.usage?.promptTokens, 5);
  assert.equal(completed.usage?.completionTokens, 3);
  assert.equal(completed.usage?.totalTokens, 8);
  assert.equal(typeof completed.latency, "number");
  assert.ok(completed.executionId);
  assert.equal(typeof completed.timestamp, "number");
});

test("telemetry marks a transient failure retryable and an auth failure not", async () => {
  const t1 = new ExecutionTelemetryEngine();
  await executeInference(params(registryWith(fail("429 rate limit exceeded"))), [t1]);
  const e1 = t1.last();
  assert.ok(e1 && e1.type === "execution.failed");
  assert.equal(e1.error.kind, "rate_limit");
  assert.equal(e1.retryable, true);

  const t2 = new ExecutionTelemetryEngine();
  await executeInference(params(registryWith(fail("401 unauthorized: api key invalid"))), [t2]);
  const e2 = t2.last();
  assert.ok(e2 && e2.type === "execution.failed");
  assert.equal(e2.error.kind, "authentication");
  assert.equal(e2.retryable, false);
});

// ── Metrics ───────────────────────────────────────────────────────────────────

test("metrics collector accumulates from telemetry events", async () => {
  const t = new ExecutionTelemetryEngine();
  const m = new MetricsCollector();
  t.subscribe((e) => m.record(e));

  await executeInference(params(registryWith(succeed)), [t]);
  await executeInference(params(registryWith(fail("503 unavailable"))), [t]);

  const snap = m.snapshot();
  assert.equal(snap.totalExecutions, 2);
  assert.equal(snap.successCount, 1);
  assert.equal(snap.failureCount, 1);
  assert.equal(snap.promptTokens, 5);
  assert.equal(snap.completionTokens, 3);
  assert.equal(snap.totalTokens, 8);
  assert.equal(snap.providerUsage.p?.executions, 2);
  assert.equal(snap.providerUsage.p?.successes, 1);
  assert.equal(snap.providerUsage.p?.failures, 1);
  assert.equal(snap.modelUsage.m?.executions, 2);
  assert.ok(snap.latencyMsTotal >= 0);
});

// ── Audit ─────────────────────────────────────────────────────────────────────

test("audit engine builds an immutable record for a success", async () => {
  const a = new ExecutionAuditEngine();
  const req: CompletionRequest = { prompt: "audit me" };
  await executeInference(params(registryWith(succeed), req), [a]);
  const rec = a.last();
  assert.ok(rec);
  assert.equal(rec.selectedProvider, "p");
  assert.equal(rec.selectedModel, "m");
  assert.equal(rec.executionResult.success, true);
  assert.equal(rec.requestFingerprint, fingerprint(req));
  assert.ok(rec.responseFingerprint.startsWith("fp_"));
  assert.ok(rec.routingDecision);
  assert.equal(rec.routingDecision?.selectedProvider, "p");
  assert.equal(Object.isFrozen(rec), true);
  assert.throws(() => { (rec as { selectedProvider: string }).selectedProvider = "x"; }, TypeError);
});

test("audit engine records a failed execution", async () => {
  const a = new ExecutionAuditEngine();
  await executeInference(params(registryWith(fail("timed out"))), [a]);
  const rec = a.last();
  assert.ok(rec);
  assert.equal(rec.executionResult.success, false);
  assert.equal(rec.executionResult.error?.kind, "timeout");
  assert.ok(rec.responseFingerprint.startsWith("fp_"));
});

// ── Health ────────────────────────────────────────────────────────────────────

test("health collector observes success, unavailability, and rate limits", async () => {
  const h = new PassiveHealthCollector();
  assert.equal(h.health("p").status, "unknown");

  await executeInference(params(registryWith(succeed)), [h]);
  const healthy = h.health("p");
  assert.equal(healthy.status, "healthy");
  assert.equal(typeof healthy.latencyMsP50, "number");
  assert.ok(healthy.checkedAt);

  await executeInference(params(registryWith(fail("503 service unavailable"))), [h]);
  assert.equal(h.health("p").status, "unavailable");

  await executeInference(params(registryWith(fail("429 rate limit"))), [h]);
  assert.equal(h.health("p").status, "degraded");
});

// ── Middleware ordering ─────────────────────────────────────────────────────────

test("middleware runs in priority order via the registry", async () => {
  clearExecutionHooks();
  const order: string[] = [];
  const mk = (name: string, priority: number): ExecutionMiddleware => ({
    name,
    priority,
    beforeExecute: () => { order.push(name); },
  });
  // Register out of priority order; the chain must still run low→high.
  registerMiddleware(mk("health", MIDDLEWARE_PRIORITY.health));
  registerMiddleware(mk("telemetry", MIDDLEWARE_PRIORITY.telemetry));
  registerMiddleware(mk("audit", MIDDLEWARE_PRIORITY.audit));
  try {
    assert.deepEqual(listMiddleware().map((m) => m.name), ["telemetry", "audit", "health"]);
    await executeInference(params(registryWith(succeed)));
    assert.deepEqual(order, ["telemetry", "audit", "health"]);
  } finally {
    clearExecutionHooks();
  }
});

// ── Hook ordering ───────────────────────────────────────────────────────────────

test("hooks order by priority, then by registration order", () => {
  clearExecutionHooks();
  const mk = (name: string, priority?: number): ExecutionHook => ({ name, priority });
  registerExecutionHook(mk("c", 30));
  registerExecutionHook(mk("a1", 10));
  registerExecutionHook(mk("a2", 10));
  registerExecutionHook(mk("b", 20));
  registerExecutionHook(mk("z")); // undefined → priority 0, runs first
  try {
    assert.deepEqual(listExecutionHooks().map((h) => h.name), ["z", "a1", "a2", "b", "c"]);
  } finally {
    clearExecutionHooks();
  }
});

// ── Provider invocation unchanged ────────────────────────────────────────────────

test("observation does not alter the provider call", async () => {
  let calls = 0;
  let seen: CompletionRequest | null = null;
  const probe: ModelProvider["complete"] = async (req) => { calls++; seen = req; return OK; };
  const req: CompletionRequest = { prompt: "hi" };
  await executeInference(
    params(registryWith(probe), req),
    [new ExecutionTelemetryEngine(), new ExecutionAuditEngine(), new PassiveHealthCollector()],
  );
  assert.equal(calls, 1);
  assert.equal((seen as CompletionRequest | null)?.prompt, "hi");
  // The caller's request object is not mutated by any middleware.
  assert.deepEqual(req, { prompt: "hi" });
});

// ── Execution result unchanged ───────────────────────────────────────────────────

test("the normalized result is identical with and without observation", async () => {
  const bare = await executeInference(params(registryWith(succeed)), []);
  const observed = await executeInference(
    params(registryWith(succeed)),
    [new ExecutionTelemetryEngine(), new ExecutionAuditEngine(), new PassiveHealthCollector()],
  );
  const stable = (r: typeof bare) => ({
    provider: r.provider,
    model: r.model,
    response: r.response,
    json: r.json,
    usage: r.usage,
    finishReason: r.finishReason,
    success: r.success,
    error: r.error,
  });
  assert.deepEqual(stable(observed), stable(bare));
});

test("a throwing observer can never break or fail execution", async () => {
  const t = new ExecutionTelemetryEngine();
  t.subscribe(() => { throw new Error("observer bug"); });
  const res = await executeInference(params(registryWith(succeed)), [t]);
  assert.equal(res.success, true);
  assert.equal(res.response, "hello");
  // Despite the throwing subscriber, the event was still captured.
  assert.equal(t.last()?.type, "execution.completed");
});

// ── Request fingerprint ─────────────────────────────────────────────────────────

test("the request fingerprint is recorded on the context and is stable", async () => {
  const seen: string[] = [];
  const capture: ExecutionHook = { name: "cap", beforeExecute: (ctx: InferenceExecutionContext) => { seen.push(ctx.requestFingerprint); } };
  await executeInference(params(registryWith(succeed), { prompt: "same" }), [capture]);
  await executeInference(params(registryWith(succeed), { prompt: "same" }), [capture]);
  await executeInference(params(registryWith(succeed), { prompt: "different" }), [capture]);
  assert.ok(seen[0]?.startsWith("fp_"));
  assert.equal(seen[0], seen[1]); // identical requests → identical fingerprint
  assert.notEqual(seen[0], seen[2]); // different request → different fingerprint
});

// ── Bootstrap wiring ─────────────────────────────────────────────────────────────

test("installExecutionObservability wires the stack once and observes everything", async () => {
  clearExecutionHooks();
  const stack = observability();
  stack.installed = false; // simulate a fresh process for deterministic assertion
  stack.telemetry.reset();
  stack.metrics.reset();
  stack.audit.reset();
  stack.health.reset();

  installExecutionObservability();
  installExecutionObservability(); // idempotent — must not double-register
  try {
    const names = listExecutionHooks().map((h) => h.name).sort();
    assert.deepEqual(names, ["audit", "health", "telemetry"]);

    // Default (registry-driven) hooks — no explicit list passed.
    resetClock();
    await executeInference(params(registryWith(succeed)));

    assert.equal(stack.telemetry.last()?.type, "execution.completed");
    assert.equal(stack.metrics.snapshot().totalExecutions, 1);
    assert.equal(stack.metrics.snapshot().successCount, 1);
    assert.ok(stack.audit.last());
    assert.equal(stack.health.health("p").status, "healthy");
  } finally {
    clearExecutionHooks();
    stack.installed = false;
  }
});
