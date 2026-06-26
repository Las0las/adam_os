// Real OpenAI model adapter (§31–§32). Implements the ModelProvider interface
// using the Chat Completions API over HTTPS. Fail-closed: with no API key it
// throws clearly rather than degrading to a mock or another model.
//
// Uses the platform global `fetch` (undici) — no SDK dependency. Also serves
// Azure-OpenAI-shaped deployments that speak the same wire contract.

import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { computeCostUsd } from "../model-pricing";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Default chat/extraction model unless a model key is supplied. */
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export interface OpenAIProviderOptions {
  modelKey?: string;
  apiKey?: string;
  /** Override the base URL (e.g. an Azure OpenAI gateway). */
  baseUrl?: string;
  maxTokens?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIModelProvider implements ModelProvider {
  readonly provider = "openai";
  readonly modelKey: string;
  private readonly explicitKey?: string;
  private readonly url: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.modelKey = opts.modelKey ?? DEFAULT_OPENAI_MODEL;
    this.explicitKey = opts.apiKey;
    this.url = opts.baseUrl ?? OPENAI_CHAT_URL;
    this.defaultMaxTokens = opts.maxTokens ?? 1024;
  }

  private resolveKey(): string {
    const key = this.explicitKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        `OpenAI model '${this.modelKey}' is not usable: OPENAI_API_KEY is not set. ` +
          `Refusing to substitute another model — set the key or configure a different provider.`,
      );
    }
    return key;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.resolveKey();
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const messages = request.outputSchema
      ? [
          {
            role: "system",
            content:
              "Respond with a single valid JSON object conforming to this JSON schema: " +
              JSON.stringify(request.outputSchema),
          },
          { role: "user", content: request.prompt },
        ]
      : [{ role: "user", content: request.prompt }];

    const startedAt = Date.now();
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelKey,
        max_tokens: maxTokens,
        messages,
        ...(request.outputSchema ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new Error(`OpenAI API error ${res.status} for '${this.modelKey}': ${detail}`);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const latencyMs = Date.now() - startedAt;

    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

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

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI response was expected to be JSON but could not be parsed.");
  }
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}
