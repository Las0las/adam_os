// The real model adapters must fail clearly when their API key is absent — they
// never fabricate output or fall back to another model.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicModelProvider, DEFAULT_ANTHROPIC_MODEL } from "@/lib/integrations/anthropic/anthropic-client";
import { OpenAIModelProvider, DEFAULT_OPENAI_MODEL } from "@/lib/integrations/openai/openai-client";
import { GoogleModelProvider, DEFAULT_GOOGLE_MODEL } from "@/lib/integrations/google/google-client";
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
  // 1M input + 1M output of Gemini 2.0 Flash = $0.10 + $0.40.
  assert.equal(computeCostUsd("google", "gemini-2.0-flash", 1_000_000, 1_000_000), 0.5);
});

test("Google adapter defaults to Gemini 2.0 Flash", () => {
  const provider = new GoogleModelProvider();
  assert.equal(provider.provider, "google");
  assert.equal(provider.modelKey, DEFAULT_GOOGLE_MODEL);
  assert.equal(DEFAULT_GOOGLE_MODEL, "gemini-2.0-flash");
});

test("Google adapter throws clearly when no key is configured", async () => {
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const provider = new GoogleModelProvider();
  await assert.rejects(() => provider.complete({ prompt: "hello" }), /GOOGLE_API_KEY/);
});

test("Google adapter parses a Gemini response and computes cost (live wire contract)", async () => {
  const realFetch = globalThis.fetch;
  process.env.GOOGLE_API_KEY = "test-key";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"fullName":"Dana Diaz"}' }] } }],
        usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const provider = new GoogleModelProvider({ modelKey: "gemini-2.0-flash" });
    const res = await provider.complete({ prompt: "extract", outputSchema: { type: "object" } });
    assert.equal(res.provider, "google");
    assert.deepEqual(res.json, { fullName: "Dana Diaz" });
    assert.equal(res.promptTokens, 1_000_000);
    assert.equal(res.costUsd, 0.5); // $0.10 + $0.40 per 1M
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GOOGLE_API_KEY;
  }
});
