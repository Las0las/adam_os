// IOS-018 — Model Capability Registry (per AS-001). The canonical producer of
// ModelCapability/ModelDescriptor metadata, implementing the IOS-002 contract.
// Declarative/observational: it derives capabilities from published provider
// declarations, optionally enriches them with benchmark/evaluation observations,
// and SHALL NOT influence routing. These tests prove derivation correctness,
// immutability, read-only consumption, benchmark/evaluation enrichment, and that
// routing does not depend on the registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import { ModelCapabilityRegistry } from "@/lib/aiops/capability/capability-registry";
import { deriveCapability } from "@/lib/aiops/capability/capability-types";
import type { BenchmarkResult } from "@/lib/aiops/benchmark/benchmark-types";
import type { EvaluationReport } from "@/lib/aiops/evaluation/evaluation-types";

function desc(provider: string, model: string, over: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    provider, publisher: "acme", family: "fam", model, version: null,
    contextWindow: 128_000, supportsVision: true, supportsTools: false,
    supportsStreaming: false, supportsJSON: true, supportsReasoning: false,
    supportsEmbeddings: false, pricing: null, deprecated: false, ...over,
  };
}
function registry(...specs: Array<{ id: string; descriptors: ModelDescriptor[] }>): ProviderRegistry {
  const reg = createProviderRegistry();
  for (const s of specs) {
    reg.register(defineProvider({
      metadata: { id: s.id, vendor: s.id, displayName: s.id, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
      descriptors: s.descriptors, requiredEnv: [], defaultPriority: 10, create: () => ({ provider: s.id, modelKey: s.descriptors[0]!.model, complete: async () => { throw new Error("unused"); } }), createDefault: () => ({ provider: s.id, modelKey: s.descriptors[0]!.model, complete: async () => { throw new Error("unused"); } }),
    }));
  }
  return reg;
}

// ── Derivation correctness (canonical producer of IOS-002 metadata) ──────────

test("capabilities are derived from published provider declarations", () => {
  const reg = registry(
    { id: "p1", descriptors: [desc("p1", "m1", { supportsTools: true })] },
    { id: "p2", descriptors: [desc("p2", "m2", { contextWindow: 8_000 })] },
  );
  const cr = new ModelCapabilityRegistry().buildFrom(reg);
  const store = cr.capabilities();
  assert.equal(store.all().length, 2);
  const c1 = store.get("p1", "m1")!;
  assert.equal(c1.capabilities.vision, true);
  assert.equal(c1.capabilities.tools, true);
  assert.equal(c1.publisher, "acme");
  assert.equal(c1.contextWindow, 128_000);
  // It also exposes the ModelDescriptor metadata it produces.
  assert.equal(store.descriptor("p2", "m2")!.contextWindow, 8_000);
  assert.equal(store.descriptors().length, 2);
});

test("deriveCapability matches the descriptor's capability set", () => {
  const d = desc("p", "m", { supportsReasoning: true });
  const cap = deriveCapability(d);
  assert.deepEqual(cap.capabilities, { vision: true, tools: false, streaming: false, json: true, reasoning: true, embeddings: false });
});

// ── Immutability ─────────────────────────────────────────────────────────────

test("produced ModelCapability records are immutable", () => {
  const reg = registry({ id: "p1", descriptors: [desc("p1", "m1")] });
  const store = new ModelCapabilityRegistry().buildFrom(reg).capabilities();
  const c = store.get("p1", "m1")!;
  assert.equal(Object.isFrozen(c), true);
  assert.equal(Object.isFrozen(c.capabilities), true);
  assert.throws(() => { (c as { deprecated: boolean }).deprecated = true; }, TypeError);
});

// ── Read-only consumption (Canonical Object Contract) ────────────────────────

test("building does not mutate the consumed provider declarations", () => {
  const reg = registry({ id: "p1", descriptors: [desc("p1", "m1")] });
  const before = JSON.stringify(reg.list());
  new ModelCapabilityRegistry().buildFrom(reg);
  assert.equal(JSON.stringify(reg.list()), before, "provider declarations are read-only");
});

// ── Benchmark enrichment (declarative, new immutable records) ────────────────

test("benchmark observations enrich capabilities without mutating the results", () => {
  const reg = registry({ id: "p1", descriptors: [desc("p1", "m1")] });
  const cr = new ModelCapabilityRegistry().buildFrom(reg);
  const results: BenchmarkResult[] = [
    { provider: "p1", model: "m1", workloadType: "chat", caseId: "c1", latencyMs: 1, tokenUsage: null, executionOutcome: "success", success: true, normalizedScore: 1, validationErrors: [], retryCount: 0, fallbackOccurred: false, circuitBreakerState: "unknown", healthSnapshotRef: "p1|m1" },
    { provider: "p1", model: "m1", workloadType: "chat", caseId: "c2", latencyMs: 1, tokenUsage: null, executionOutcome: "failure", success: false, normalizedScore: 0, validationErrors: [], retryCount: 0, fallbackOccurred: false, circuitBreakerState: "unknown", healthSnapshotRef: "p1|m1" },
  ];
  const snapshot = JSON.stringify(results);
  cr.enrichFromBenchmark(results);
  const c = cr.capabilities().get("p1", "m1")!;
  assert.deepEqual(c.benchmark, { runs: 2, averageScore: 0.5 });
  assert.equal(Object.isFrozen(c), true);
  assert.equal(JSON.stringify(results), snapshot, "consumed BenchmarkResults are unchanged");
});

// ── Evaluation enrichment (per provider) ─────────────────────────────────────

test("evaluation observations enrich capabilities per provider", () => {
  const reg = registry({ id: "p1", descriptors: [desc("p1", "m1")] });
  const cr = new ModelCapabilityRegistry().buildFrom(reg);
  const reports: EvaluationReport[] = [
    { evaluationId: "e1", total: 2, passed: 2, failed: 0, passRate: 1, averageScore: 1, byProvider: { p1: { passRate: 1, averageScore: 1 } }, results: [], observedAt: 0 },
    { evaluationId: "e2", total: 2, passed: 1, failed: 1, passRate: 0.5, averageScore: 0.5, byProvider: { p1: { passRate: 0.5, averageScore: 0.5 } }, results: [], observedAt: 0 },
  ];
  cr.enrichFromEvaluation(reports);
  const c = cr.capabilities().get("p1", "m1")!;
  assert.deepEqual(c.evaluation, { reports: 2, passRate: 0.75 });
});

// ── Does not influence routing (architecture guard) ──────────────────────────

test("the routing engine does not depend on the capability registry", () => {
  const router = readFileSync(join(process.cwd(), "src/lib/aiops/routing/routing-engine.ts"), "utf8");
  assert.ok(!/aiops\/capability\//.test(router), "routing-engine must not import the IOS-018 capability registry");
});
