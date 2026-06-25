// Model routing is fail-closed (§31–§32): a tenant that authorizes a real
// provider whose key is absent must error rather than silently substituting a
// different model; an unconfigured tenant falls back to the deterministic mock.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock, id } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { setModelProvider, MockModelProvider } from "@/lib/aiops/models/model-provider";
import {
  resolveDefaultProvider,
  resolveModelProvider,
  providerFromDefinition,
} from "@/lib/aiops/models/model-router";
import type { ModelDefinition } from "@/types/aiops";

function clearProviderKeys() {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.LAWRENCE_DEFAULT_MODEL;
}

async function fresh() {
  await resetDatabase();
  resetClock();
  clearProviderKeys();
  setModelProvider(new MockModelProvider());
  return systemActor("tnt_test");
}

function def(partial: Partial<ModelDefinition>): ModelDefinition {
  return {
    id: id("model"),
    tenantId: "tnt_test",
    provider: "anthropic",
    modelKey: "claude-opus-4-8",
    purpose: "chat",
    config: {},
    status: "active",
    ...partial,
  };
}

test("resolveDefaultProvider returns the mock when no provider key is set", async () => {
  clearProviderKeys();
  const provider = resolveDefaultProvider();
  assert.equal(provider.provider, "mock");
});

test("resolveDefaultProvider returns Anthropic when a key is present", async () => {
  clearProviderKeys();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  try {
    const provider = resolveDefaultProvider();
    assert.equal(provider.provider, "anthropic");
  } finally {
    clearProviderKeys();
  }
});

test("resolveModelProvider falls back to the process default when nothing is authorized", async () => {
  const ctx = await fresh();
  const provider = await resolveModelProvider(ctx, "chat");
  assert.equal(provider.provider, "mock");
});

test("resolveModelProvider is fail-closed when the authorized key is missing", async () => {
  const ctx = await fresh();
  await db.modelDefinitions.insert(def({ provider: "anthropic", purpose: "chat" }));
  await assert.rejects(() => resolveModelProvider(ctx, "chat"), /ANTHROPIC_API_KEY is not set/);
});

test("resolveModelProvider builds the authorized provider when the key is present", async () => {
  const ctx = await fresh();
  process.env.OPENAI_API_KEY = "sk-test";
  try {
    await db.modelDefinitions.insert(
      def({ provider: "openai", modelKey: "gpt-4.1-mini", purpose: "extraction" }),
    );
    const provider = await resolveModelProvider(ctx, "extraction");
    assert.equal(provider.provider, "openai");
    assert.equal(provider.modelKey, "gpt-4.1-mini");
  } finally {
    clearProviderKeys();
  }
});

test("providerFromDefinition refuses unknown providers", async () => {
  await fresh();
  assert.throws(
    () => providerFromDefinition(def({ provider: "google", modelKey: "gemini-x" })),
    /No adapter for provider/,
  );
});
