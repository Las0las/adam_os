// The real model adapters must fail clearly when their API key is absent — they
// never fabricate output or fall back to another model.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicModelProvider, DEFAULT_ANTHROPIC_MODEL } from "@/lib/integrations/anthropic/anthropic-client";
import { OpenAIModelProvider, DEFAULT_OPENAI_MODEL } from "@/lib/integrations/openai/openai-client";
import { computeCostUsd } from "@/lib/integrations/model-pricing";

test("Anthropic adapter defaults to the flagship Opus model", () => {
  const provider = new AnthropicModelProvider();
  assert.equal(provider.provider, "anthropic");
  assert.equal(provider.modelKey, DEFAULT_ANTHROPIC_MODEL);
  assert.equal(DEFAULT_ANTHROPIC_MODEL, "claude-opus-4-8");
});

test("Anthropic adapter throws clearly when no key is configured", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const provider = new AnthropicModelProvider();
  await assert.rejects(() => provider.complete({ prompt: "hello" }), /ANTHROPIC_API_KEY is not set/);
});

test("OpenAI adapter throws clearly when no key is configured", async () => {
  delete process.env.OPENAI_API_KEY;
  const provider = new OpenAIModelProvider();
  assert.equal(provider.modelKey, DEFAULT_OPENAI_MODEL);
  await assert.rejects(() => provider.complete({ prompt: "hello" }), /OPENAI_API_KEY is not set/);
});

test("pricing computes known models and returns 0 for unknown ones", () => {
  // 1M input + 1M output of Opus 4.8 = $5 + $25.
  assert.equal(computeCostUsd("anthropic", "claude-opus-4-8", 1_000_000, 1_000_000), 30);
  assert.equal(computeCostUsd("openai", "nonexistent-model", 1_000, 1_000), 0);
});
