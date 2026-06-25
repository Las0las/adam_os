// Real Anthropic model adapter (§31–§32). Implements the provider-agnostic
// ModelProvider interface using the Messages API over HTTPS. It is fail-closed:
// if no API key is configured it throws a clear error rather than silently
// degrading to a mock or substituting an unauthorized model.
//
// We call the REST endpoint with the platform's global `fetch` (undici) rather
// than pulling in an SDK dependency, keeping the bundle lean and the deploy
// install-free. The wire contract (headers, body, response shape) is pinned to
// the Anthropic Messages API.

import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { computeCostUsd } from "../model-pricing";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Default to the current flagship Opus model unless a model key is supplied. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

export interface AnthropicProviderOptions {
  modelKey?: string;
  apiKey?: string;
  maxTokens?: number;
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicModelProvider implements ModelProvider {
  readonly provider = "anthropic";
  readonly modelKey: string;
  private readonly explicitKey?: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: AnthropicProviderOptions = {}) {
    this.modelKey = opts.modelKey ?? DEFAULT_ANTHROPIC_MODEL;
    this.explicitKey = opts.apiKey;
    this.defaultMaxTokens = opts.maxTokens ?? 1024;
  }

  private resolveKey(): string {
    const key = this.explicitKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        `Anthropic model '${this.modelKey}' is not usable: ANTHROPIC_API_KEY is not set. ` +
          `Refusing to substitute another model — set the key or configure a different provider.`,
      );
    }
    return key;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.resolveKey();
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    // Steer JSON requests without fabricating content: instruct the model to
    // emit only JSON matching the requested shape.
    const system = request.outputSchema
      ? "Respond with a single valid JSON object only — no prose, no markdown fences. " +
        `It must conform to this JSON schema: ${JSON.stringify(request.outputSchema)}`
      : undefined;

    const startedAt = Date.now();
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.modelKey,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: request.prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new Error(`Anthropic API error ${res.status} for '${this.modelKey}': ${detail}`);
    }

    const data = (await res.json()) as AnthropicMessageResponse;
    const latencyMs = Date.now() - startedAt;

    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("")
      .trim();

    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    return {
      text,
      json: request.outputSchema ? parseJson(text) : null,
      promptTokens,
      completionTokens,
      latencyMs,
      costUsd: computeCostUsd(this.provider, this.modelKey, promptTokens, completionTokens),
      provider: this.provider,
      modelKey: this.modelKey,
    };
  }
}

/** Parse a JSON object from model text, tolerating leading/trailing prose. */
function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    throw new Error("Anthropic response was expected to be JSON but could not be parsed.");
  }
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}
