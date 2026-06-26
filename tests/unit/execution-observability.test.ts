// Execution Observability + Event Bus (Milestones 5.0 / 5.5). Observation is
// decoupled from middleware: ONE publisher middleware turns the execution
// lifecycle into immutable events and publishes them to the Execution Event Bus;
// telemetry / metrics / audit / health are priority-independent bus subscribers.
// These tests prove the bus is synchronous + isolated, every observer fires, and
// execution is completely unchanged with or without observation.
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
import { ExecutionEventBus, type ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import type { ExecutionEvent } from "@/lib/aiops/execution/observability/execution-events";
import { ExecutionTelemetryEngine } from "@/lib/aiops/execution/observability/telemetry-engine";
import { MetricsCollector } from "@/lib/aiops/execution/observability/metrics-collector";
import { ExecutionAuditEngine } from "@/lib/aiops/execution/observability/audit-engine";
import { PassiveHealthCollector } from "@/lib/aiops/execution/observability/health-collector";
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

/** A fully-wired observability stack over a fresh bus (mirrors the bootstrap). */
function wired() {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new MetricsCollector();
  const audit = new ExecutionAuditEngine();
  const health = new PassiveHealthCollector();
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  bus.subscribe(audit);
  bus.subscribe(health);
  return { bus, telemetry, metrics, audit, health, publisher: new ExecutionEventPublisher(bus) };
}

function fakeEvent(): ExecutionEvent {
  return {
    type: "execution.started",
    executionId: "e",
    requestId: "r",
    tenantId: null,
    provider: "p",
    model: "m",
    workloadType: "w",
    routingDecision: null,
    requestFingerprint: "fp_test_0",
    startTime: 0,
    timestamp: 0,
  };
}

// ── Event bus ───────────────────────────────────────────────────────────────

test("the bus delivers synchronously to every subscriber", () => {
  const bus = new ExecutionEventBus();
  const seenA: ExecutionEvent[] = [];
  const seenB: ExecutionEvent[] = [];
  bus.subscribe({ name: "a", onEvent: (e) => seenA.push(e) });
  bus.subscribe({ name: "b", onEvent: (e) => seenB.push(e) });
  bus.publish(fakeEvent());
  // Synchronous: both populated immediately after publish() returns.
  assert.equal(seenA.length, 1);
  assert.equal(seenB.length, 1);
  assert.equal(bus.subscribers().length, 2);
});

test("a throwing subscriber is isolated from its peers", () => {
  const bus = new ExecutionEventBus();
  const seen: string[] = [];
  bus.subscribe({ name: "boom", onEvent: () => { throw new Error("subscriber bug"); } });
  bus.subscribe({ name: "ok", onEvent: () => seen.push("ok") });
  assert.doesNotThrow(() => bus.publish(fakeEvent()));
  assert.deepEqual(seen, ["ok"]);
});

test("unsubscribe removes a subscriber; duplicate subscribe is a no-op", () => {
  const bus = new ExecutionEventBus();
  const sub: ExecutionEventSubscriber = { name: "s", onEvent: () => {} };
  const off = bus.subscribe(sub);
  bus.subscribe(sub); // duplicate ignored
  assert.equal(bus.subscribers().length, 1);
  off();
  assert.equal(bus.subscribers().length, 0);
});

// ── Telemetry ─────────────────────────────────────────────────────────────────

test("telemetry captures started + completed events from the bus", async () => {
  const { telemetry, publisher } = wired();
  await executeInference(params(registryWith(succeed)), [publisher]);
  const events = telemetry.events();
  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "execution.started");
  const completed = events[1];
  assert.ok(completed && completed.type === "execution.completed");
  assert.equal(completed.provider, "p");
  assert.equal(completed.model, "m");
  assert.equal(completed.workloadType, "chat");
  assert.equal(completed.tenantId, "tnt");
  assert.equal(completed.usage?.totalTokens, 8);
  assert.ok(completed.responseFingerprint.startsWith("fp_"));
  assert.ok(completed.routingDecision);
  assert.equal(typeof completed.timestamp, "number");
});

test("telemetry marks a transient failure retryable and an auth failure not", async () => {
  const a = wired();
  await executeInference(params(registryWith(fail("429 rate limit exceeded"))), [a.publisher]);
  const e1 = a.telemetry.last();
  assert.ok(e1 && e1.type === "execution.failed");
  assert.equal(e1.error.kind, "rate_limit");
  assert.equal(e1.retryable, true);

  const b = wired();
  await executeInference(params(registryWith(fail("401 unauthorized: api key invalid"))), [b.publisher]);
  const e2 = b.telemetry.last();
  assert.ok(e2 && e2.type === "execution.failed");
  assert.equal(e2.error.kind, "authentication");
  assert.equal(e2.retryable, false);
});

// ── Metrics ───────────────────────────────────────────────────────────────────

test("metrics accumulates from bus events", async () => {
  const { metrics, publisher } = wired();
  await executeInference(params(registryWith(succeed)), [publisher]);
  await executeInference(params(registryWith(fail("503 unavailable"))), [publisher]);
  const snap = metrics.snapshot();
  assert.equal(snap.totalExecutions, 2);
  assert.equal(snap.successCount, 1);
  assert.equal(snap.failureCount, 1);
  assert.equal(snap.promptTokens, 5);
  assert.equal(snap.completionTokens, 3);
  assert.equal(snap.totalTokens, 8);
  assert.equal(snap.providerUsage.p?.executions, 2);
  assert.equal(snap.modelUsage.m?.executions, 2);
});

// ── Audit ─────────────────────────────────────────────────────────────────────

test("audit builds an immutable record from a success event", async () => {
  const { audit, publisher } = wired();
  const req: CompletionRequest = { prompt: "audit me" };
  await executeInference(params(registryWith(succeed), req), [publisher]);
  const rec = audit.last();
  assert.ok(rec);
  assert.equal(rec.selectedProvider, "p");
  assert.equal(rec.selectedModel, "m");
  assert.equal(rec.executionResult.success, true);
  assert.equal(rec.requestFingerprint, fingerprint(req));
  assert.ok(rec.responseFingerprint.startsWith("fp_"));
  assert.equal(rec.routingDecision?.selectedProvider, "p");
  assert.equal(Object.isFrozen(rec), true);
  assert.throws(() => { (rec as { selectedProvider: string }).selectedProvider = "x"; }, TypeError);
});

test("audit records a failed execution", async () => {
  const { audit, publisher } = wired();
  await executeInference(params(registryWith(fail("timed out"))), [publisher]);
  const rec = audit.last();
  assert.ok(rec);
  assert.equal(rec.executionResult.success, false);
  assert.equal(rec.executionResult.error?.kind, "timeout");
  assert.ok(rec.responseFingerprint.startsWith("fp_"));
});

// ── Health ────────────────────────────────────────────────────────────────────

test("health observes success, unavailability, and rate limits", async () => {
  const { health, publisher } = wired();
  assert.equal(health.health("p").status, "unknown");

  await executeInference(params(registryWith(succeed)), [publisher]);
  const healthy = health.health("p");
  assert.equal(healthy.status, "healthy");
  assert.equal(typeof healthy.latencyMsP50, "number");
  assert.ok(healthy.checkedAt);

  await executeInference(params(registryWith(fail("503 service unavailable"))), [publisher]);
  assert.equal(health.health("p").status, "unavailable");

  await executeInference(params(registryWith(fail("429 rate limit"))), [publisher]);
  assert.equal(health.health("p").status, "degraded");
});

// ── Decoupling: one middleware, many subscribers ────────────────────────────────

test("a single publisher middleware drives all observers via the bus", async () => {
  const { bus, telemetry, metrics, audit, health, publisher } = wired();
  assert.equal(bus.subscribers().length, 4);
  // Exactly one middleware is attached to execution; everything else is a peer
  // subscriber on the bus.
  await executeInference(params(registryWith(succeed)), [publisher]);
  assert.equal(telemetry.last()?.type, "execution.completed");
  assert.equal(metrics.snapshot().totalExecutions, 1);
  assert.ok(audit.last());
  assert.equal(health.health("p").status, "healthy");
});

// ── Hook ordering (registry, unchanged) ──────────────────────────────────────────

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

// ── Execution is unchanged ────────────────────────────────────────────────────────

test("observation does not alter the provider call", async () => {
  let calls = 0;
  let seen: CompletionRequest | null = null;
  const probe: ModelProvider["complete"] = async (req) => { calls++; seen = req; return OK; };
  const req: CompletionRequest = { prompt: "hi" };
  await executeInference(params(registryWith(probe), req), [wired().publisher]);
  assert.equal(calls, 1);
  assert.equal((seen as CompletionRequest | null)?.prompt, "hi");
  assert.deepEqual(req, { prompt: "hi" }); // caller's request not mutated
});

test("the normalized result is identical with and without observation", async () => {
  const bare = await executeInference(params(registryWith(succeed)), []);
  const observed = await executeInference(params(registryWith(succeed)), [wired().publisher]);
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

test("a throwing subscriber can never break or fail execution", async () => {
  const { bus, publisher } = wired();
  bus.subscribe({ name: "boom", onEvent: () => { throw new Error("observer bug"); } });
  const res = await executeInference(params(registryWith(succeed)), [publisher]);
  assert.equal(res.success, true);
  assert.equal(res.response, "hello");
});

// ── Request fingerprint ─────────────────────────────────────────────────────────

test("the request fingerprint is recorded on the context and is stable", async () => {
  const seen: string[] = [];
  const capture: ExecutionHook = { name: "cap", beforeExecute: (ctx: InferenceExecutionContext) => { seen.push(ctx.requestFingerprint); } };
  await executeInference(params(registryWith(succeed), { prompt: "same" }), [capture]);
  await executeInference(params(registryWith(succeed), { prompt: "same" }), [capture]);
  await executeInference(params(registryWith(succeed), { prompt: "different" }), [capture]);
  assert.ok(seen[0]?.startsWith("fp_"));
  assert.equal(seen[0], seen[1]);
  assert.notEqual(seen[0], seen[2]);
});

// ── Bootstrap wiring ─────────────────────────────────────────────────────────────

test("installExecutionObservability registers ONE middleware and observes everything", async () => {
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
    const middleware = listExecutionHooks();
    assert.equal(middleware.length, 1);
    assert.equal(middleware[0]?.name, "event-bus");
    assert.equal(stack.bus.subscribers().length, 4);

    resetClock();
    await executeInference(params(registryWith(succeed))); // default (registry) hooks

    assert.equal(stack.telemetry.last()?.type, "execution.completed");
    assert.equal(stack.metrics.snapshot().totalExecutions, 1);
    assert.ok(stack.audit.last());
    assert.equal(stack.health.health("p").status, "healthy");
  } finally {
    clearExecutionHooks();
    stack.installed = false;
  }
});
