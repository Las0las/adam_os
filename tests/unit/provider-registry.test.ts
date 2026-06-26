// Provider Platform — registry contract (Milestone 2.0). Registration, lookup,
// enumeration, descriptor validation, capability discovery, immutability. Plus
// the global registry has the five production providers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry, providerRegistry } from "@/lib/aiops/providers/provider-registry";
import "@/lib/aiops/providers/provider-registry-bootstrap";
import { defineProvider } from "@/lib/aiops/providers/define-provider";
import {
  capabilitySetOf,
  assertValidDescriptor,
  type ModelDescriptor,
} from "@/lib/aiops/providers/provider-registry-types";
import { MockModelProvider } from "@/lib/aiops/models/model-provider";

function desc(provider: string, model: string, over: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    provider,
    publisher: "acme",
    family: "fam",
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

function provider(id: string, descriptors: ModelDescriptor[]) {
  return defineProvider({
    metadata: {
      id,
      vendor: id,
      displayName: id,
      authType: "none",
      endpoint: "http://x",
      supportsBatch: false,
      supportsStreaming: false,
    },
    descriptors,
    requiredEnv: [],
    defaultPriority: 100,
    create: () => new MockModelProvider(),
    createDefault: () => new MockModelProvider(),
  });
}

test("register + lookup", () => {
  const reg = createProviderRegistry();
  reg.register(provider("p1", [desc("p1", "m1")]));
  assert.equal(reg.has("p1"), true);
  assert.equal(reg.get("p1")?.metadata.id, "p1");
  assert.equal(reg.has("nope"), false);
  assert.equal(reg.get("nope"), undefined);
});

test("duplicate registration throws", () => {
  const reg = createProviderRegistry();
  reg.register(provider("p1", [desc("p1", "m1")]));
  assert.throws(() => reg.register(provider("p1", [desc("p1", "m2")])), /already registered/);
});

test("provider and model enumeration", () => {
  const reg = createProviderRegistry();
  reg.register(provider("p1", [desc("p1", "m1"), desc("p1", "m2")]));
  reg.register(provider("p2", [desc("p2", "m3")]));
  assert.deepEqual(reg.list().map((p) => p.metadata.id).sort(), ["p1", "p2"]);
  assert.equal(reg.listModels().length, 3);
  assert.equal(reg.getModel("p1", "m2")?.model, "m2");
  assert.equal(reg.getModel("p1", "missing"), undefined);
});

test("descriptor validation rejects malformed descriptors", () => {
  const reg = createProviderRegistry();
  assert.throws(() => reg.register(provider("bad", [desc("bad", "")])), /non-empty string/);
  assert.throws(() => assertValidDescriptor(desc("p", "m", { contextWindow: 0 })), /contextWindow/);
});

test("capability discovery reads descriptor flags, never the provider name", () => {
  const reg = createProviderRegistry();
  // Same provider; capability differs purely by the descriptor's declared flag.
  reg.register(
    provider("vendorx", [
      desc("vendorx", "sees", { supportsVision: true }),
      desc("vendorx", "blind", { supportsVision: false }),
    ]),
  );
  const vision = reg.listModels().filter((m) => capabilitySetOf(m).vision);
  assert.equal(vision.length, 1);
  assert.equal(vision[0]?.model, "sees");
});

test("registered descriptors and enumerations are immutable", () => {
  const reg = createProviderRegistry();
  reg.register(provider("p1", [desc("p1", "m1")]));
  const d = reg.get("p1")!.descriptors[0]!;
  assert.equal(Object.isFrozen(d), true);
  assert.throws(() => {
    (d as { contextWindow: number }).contextWindow = 1;
  }, TypeError);
  const models = reg.listModels();
  assert.equal(Object.isFrozen(models), true);
  assert.throws(() => (models as ModelDescriptor[]).push(desc("p1", "x")), TypeError);
});

test("the global registry holds the five production providers with valid descriptors", () => {
  const ids = providerRegistry.list().map((p) => p.metadata.id);
  for (const id of ["anthropic", "openai", "azure_openai", "google", "github_models"]) {
    assert.ok(ids.includes(id), `registry includes ${id}`);
    assert.ok((providerRegistry.get(id)?.descriptors.length ?? 0) >= 1, `${id} publishes descriptors`);
  }
  providerRegistry.listModels().forEach(assertValidDescriptor);

  // Capability is per-model, not per-provider: GitHub's meta/mistral models are
  // non-vision even though the same provider also fronts a vision model.
  const gh = providerRegistry.get("github_models")!;
  const meta = gh.descriptors.find((d) => d.publisher === "meta")!;
  assert.equal(capabilitySetOf(meta).vision, false);
});
