// Model abstraction layer (§31–§32, §55). A provider-agnostic interface so the
// function/agent runtimes never hard-code a vendor. The default provider is a
// deterministic mock so the platform is runnable end-to-end without API keys;
// real OpenAI/Anthropic/etc. providers implement the same interface.

import { recordModelCost } from "./cost-meter";

export interface CompletionRequest {
  prompt: string;
  /** When set, the provider must return JSON parseable to this shape. */
  outputSchema?: Record<string, unknown> | null;
  maxTokens?: number;
}

export interface CompletionResponse {
  text: string;
  json?: Record<string, unknown> | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  provider: string;
  modelKey: string;
}

export interface ModelProvider {
  provider: string;
  modelKey: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Deterministic mock provider. It does not invent facts: for schema requests it
 * returns an empty object skeleton; for free-text it echoes a structured,
 * grounded summary of the prompt. Real reasoning is swapped in via a real
 * provider with the same interface.
 */
export class MockModelProvider implements ModelProvider {
  provider = "mock";
  modelKey = "mock-deterministic-1";

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const promptTokens = estimateTokens(request.prompt);
    let text: string;
    let json: Record<string, unknown> | null = null;
    if (request.outputSchema) {
      json = skeletonFromSchema(request.outputSchema);
      text = JSON.stringify(json);
    } else {
      text = synthesizeText(request.prompt);
    }
    const completionTokens = estimateTokens(text);
    return {
      text,
      json,
      promptTokens,
      completionTokens,
      latencyMs: promptTokens + completionTokens,
      costUsd: 0,
      provider: this.provider,
      modelKey: this.modelKey,
    };
  }
}

function synthesizeText(prompt: string): string {
  const lines = prompt.split("\n").map((l) => l.trim()).filter(Boolean);
  const tail = lines.slice(-6);
  return `Based on the provided context, here is a grounded synthesis:\n${tail.join(" ")}`.slice(0, 800);
}

/** Build an empty-but-valid object from a minimal JSON-schema-ish definition. */
function skeletonFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema.properties as Record<string, { type?: string }> | undefined) ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(props)) {
    switch (def.type) {
      case "array":
        out[key] = [];
        break;
      case "number":
        out[key] = 0;
        break;
      case "boolean":
        out[key] = false;
        break;
      case "object":
        out[key] = {};
        break;
      default:
        out[key] = "";
    }
  }
  return out;
}

let activeProvider: ModelProvider = new MockModelProvider();

/** Wrap a provider so each completion records its USD cost into the active cost
 *  meter (drives the agent dollar budget). No-op when no meter is in scope. */
function metered(inner: ModelProvider): ModelProvider {
  return {
    provider: inner.provider,
    modelKey: inner.modelKey,
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const response = await inner.complete(request);
      recordModelCost(response.costUsd);
      return response;
    },
  };
}

export function getModelProvider(): ModelProvider {
  return metered(activeProvider);
}

export function setModelProvider(provider: ModelProvider): void {
  activeProvider = provider;
}
