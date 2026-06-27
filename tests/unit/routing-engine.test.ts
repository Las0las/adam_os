// Governed Routing Engine (Milestone 3.0). Deterministic capability + policy
// driven selection producing an immutable RoutingDecision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, type ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import type { ModelDescriptor } from "@/lib/aiops/providers/provider-registry-types";
import { MockModelProvider } from "@/lib/aiops/models/model-provider";
import { route } from "@/lib/aiops/routing/routing-engine";
import type { ExecutionTarget, RoutingPolicy, RoutingRequest } from "@/lib/aiops/routing/routing-types";

function desc(provider: string, model: string, family: string, over: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    provider,
    publisher: "acme",
    family,
    model,
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
    ...over,
  };
}

function reg(...providers: Array<{ id: string; priority: number; descriptors: ModelDescriptor[] }>): ProviderRegistry {
  const r = createProviderRegistry();
  for (const p of providers) {
    r.register(
      defineProvider({
        metadata: { id: p.id, vendor: p.id, displayName: p.id, authType: "none", endpoint: "x", supportsBatch: false, supportsStreaming: false },
        descriptors: p.descriptors,
        requiredEnv: [],
        defaultPriority: p.priority,
        create: () => new MockModelProvider(),
        createDefault: () => new MockModelProvider(),
      }),
    );
  }
  return r;
}

function fixture(): ProviderRegistry {
  return reg(
    {
      id: "alpha",
      priority: 10,
      descriptors: [
        desc("alpha", "a-basic", "fam-a", { contextWindow: 8_000 }),
        desc("alpha", "a-vision", "gpt", {
          supportsVision: true,
          supportsTools: true,
          supportsStreaming: true,
          supportsJSON: true,
          contextWindow: 128_000,
        }),
      ],
    },
    {
      id: "beta",
      priority: 20,
      descriptors: [
        desc("beta", "b-vision", "claude", { supportsVision: true, supportsJSON: true, contextWindow: 200_000 }),
        desc("beta", "b-embed", "embed", { supportsEmbeddings: true, contextWindow: 8_000 }),
      ],
    },
  );
}

const VISION: RoutingRequest = { workloadType: "chat", requiredCapabilities: ["vision"] };

test("capability filtering selects a vision model and rejects the rest", () => {
  const d = route(VISION, {}, fixture());
  assert.equal(d.selectedProvider, "alpha"); // priority 10 wins, no preference
  assert.equal(d.selectedModel, "a-vision");
  assert.ok(d.rejectionReasons.some((r) => r.model === "a-basic" && /missing capability: vision/.test(r.reason)));
  assert.ok(d.rejectionReasons.some((r) => r.model === "b-embed" && /missing capability: vision/.test(r.reason)));
});

test("structuredOutputRequired implies the json capability", () => {
  const d = route({ workloadType: "x", structuredOutputRequired: true }, {}, fixture());
  // a-basic (no json) and b-embed (no json) are rejected; a-vision wins on priority.
  assert.equal(d.selectedModel, "a-vision");
  assert.ok(d.rejectionReasons.some((r) => r.model === "b-embed" && /missing capability: json/.test(r.reason)));
});

test("deny policy removes a provider; allow policy restricts to one", () => {
  const denied = route(VISION, { deniedProviders: ["alpha"] }, fixture());
  assert.equal(denied.selectedProvider, "beta");
  assert.ok(denied.rejectionReasons.some((r) => r.provider === "alpha" && /deniedProviders/.test(r.reason)));

  const allowed = route(VISION, { allowedProviders: ["alpha"] }, fixture());
  assert.equal(allowed.selectedProvider, "alpha");
  assert.ok(allowed.rejectionReasons.some((r) => r.provider === "beta" && /allowedProviders/.test(r.reason)));
});

test("preferred provider overrides default priority ordering", () => {
  const d = route({ ...VISION, preferredProvider: "beta" }, {}, fixture());
  assert.equal(d.selectedProvider, "beta");
  assert.equal(d.selectedModel, "b-vision");
});

test("preferred model wins outright", () => {
  const d = route({ ...VISION, preferredModel: "b-vision" }, {}, fixture());
  assert.equal(d.selectedModel, "b-vision");
});

test("missing capability yields no selection with reasons", () => {
  const d = route({ workloadType: "x", requiredCapabilities: ["reasoning"] }, {}, fixture());
  assert.equal(d.selectedProvider, null);
  assert.equal(d.selectedModel, null);
  assert.ok(d.rejectionReasons.length >= 4);
  assert.ok(d.rejectionReasons.every((r) => /missing capability: reasoning/.test(r.reason)));
});

test("no eligible provider when the context window cannot be met", () => {
  const d = route({ workloadType: "x", minimumContextWindow: 1_000_000 }, {}, fixture());
  assert.equal(d.selectedProvider, null);
  assert.ok(d.rejectionReasons.every((r) => /< required 1000000/.test(r.reason)));
});

test("policy.maximumContextWindow caps eligible models", () => {
  // alpha/a-vision (128k) passes; beta/b-vision (200k) exceeds the cap.
  const d = route(VISION, { maximumContextWindow: 150_000 }, fixture());
  assert.equal(d.selectedModel, "a-vision");
  assert.ok(d.rejectionReasons.some((r) => r.model === "b-vision" && /exceeds policy maximum/.test(r.reason)));
});

test("requiredModelFamilies filters by family, never provider name", () => {
  const d = route(VISION, { requiredModelFamilies: ["claude"] }, fixture());
  assert.equal(d.selectedModel, "b-vision"); // only the claude-family vision model survives
  assert.ok(d.rejectionReasons.some((r) => r.model === "a-vision" && /requiredModelFamilies/.test(r.reason)));
});

test("evaluation is deterministic and ordered by priority then id", () => {
  const r = reg(
    { id: "gamma", priority: 10, descriptors: [desc("gamma", "g-vision", "g", { supportsVision: true })] },
    { id: "alpha", priority: 10, descriptors: [desc("alpha", "a-vision", "a", { supportsVision: true })] },
    { id: "beta", priority: 20, descriptors: [desc("beta", "b-vision", "b", { supportsVision: true })] },
  );
  // alpha and gamma tie on priority -> lexicographic id tie-break picks alpha.
  const first = route(VISION, {}, r);
  assert.equal(first.selectedProvider, "alpha");
  for (let i = 0; i < 5; i += 1) {
    const again = route(VISION, {}, r);
    assert.deepEqual(again.selectedProvider, first.selectedProvider);
    assert.deepEqual(again.selectedModel, first.selectedModel);
    assert.deepEqual([...again.evaluatedProviders], [...first.evaluatedProviders]);
  }
});

test("tenant override changes the effective policy deterministically", () => {
  const policy: RoutingPolicy = {
    allowedProviders: ["alpha"],
    tenantOverrides: { t1: { allowedProviders: ["beta"] } },
  };
  assert.equal(route(VISION, policy, fixture()).selectedProvider, "alpha"); // no tenant
  assert.equal(route({ ...VISION, tenantId: "t1" }, policy, fixture()).selectedProvider, "beta"); // override
});

test("the RoutingDecision is immutable", () => {
  const d = route(VISION, { allowedProviders: ["alpha"] }, fixture());
  assert.equal(Object.isFrozen(d), true);
  assert.throws(() => {
    (d as { selectedProvider: string | null }).selectedProvider = "beta";
  }, TypeError);
  assert.equal(Object.isFrozen(d.rejectionReasons), true);
  assert.equal(Object.isFrozen(d.policySnapshot), true);
  assert.throws(() => (d.evaluatedProviders as string[]).push("x"), TypeError);
});

// ── Execution Plan (ADR-0004) ────────────────────────────────────────────────

test("routing emits an ordered Execution Plan with the primary first", () => {
  // Three vision models; alpha & gamma tie on priority (alpha wins on id), beta last.
  const r = reg(
    { id: "gamma", priority: 10, descriptors: [desc("gamma", "g-vision", "g", { supportsVision: true })] },
    { id: "alpha", priority: 10, descriptors: [desc("alpha", "a-vision", "a", { supportsVision: true })] },
    { id: "beta", priority: 20, descriptors: [desc("beta", "b-vision", "b", { supportsVision: true })] },
  );
  const d = route(VISION, {}, r);
  const plan = d.executionPlan!;
  assert.ok(plan, "a plan is emitted");
  // Deterministic order: alpha (id tie-break) → gamma → beta (priority).
  assert.deepEqual(plan.targets.map((t) => `${t.provider}|${t.model}`), ["alpha|a-vision", "gamma|g-vision", "beta|b-vision"]);
  // targets[0] is the selected/primary target.
  assert.deepEqual(plan.targets[0], { provider: d.selectedProvider, model: d.selectedModel });
});

test("the Execution Plan is immutable (frozen, ordered, enumerable)", () => {
  const d = route(VISION, {}, fixture());
  const plan = d.executionPlan!;
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.targets), true);
  assert.ok(Array.isArray(plan.targets), "an ordered, enumerable collection");
  assert.equal(Object.isFrozen(plan.targets[0]), true);
  // Middleware may iterate/select but SHALL NOT modify, insert, remove, or reorder.
  assert.throws(() => (plan.targets as ExecutionTarget[]).push({ provider: "x", model: "y" }), TypeError);
  assert.throws(() => { (plan.targets[0] as { provider: string }).provider = "z"; }, TypeError);
});

test("Execution Plan ordering is deterministic across repeated evaluations", () => {
  const first = route(VISION, {}, fixture()).executionPlan!.targets.map((t) => `${t.provider}|${t.model}`);
  for (let i = 0; i < 5; i += 1) {
    const again = route(VISION, {}, fixture()).executionPlan!.targets.map((t) => `${t.provider}|${t.model}`);
    assert.deepEqual(again, first);
  }
});
