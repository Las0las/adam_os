// Real GitHub Models adapter (§31–§32). GitHub Models exposes many publishers'
// models (OpenAI, Llama, Mistral, Phi, …) behind one OpenAI-compatible inference
// endpoint. Model names are `publisher/model` (e.g. "openai/gpt-4o-mini").
//
// Auth is a GitHub token with `models: read`. We read a DEDICATED
// `GITHUB_MODELS_TOKEN` rather than the ubiquitous `GITHUB_TOKEN`, so the provider
// never activates by accident in CI/Actions environments where GITHUB_TOKEN is
// present for unrelated reasons. Fail-closed: no token throws clearly.
//
// Uses the platform global `fetch` (undici) — no SDK dependency.

import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { computeCostUsd } from "../model-pricing";

const GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference";

/** Default model unless one is supplied (publisher/model form). */
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini";

export interface GitHubModelsProviderOptions {
  modelKey?: string;
  apiKey?: string;
  /** Override the base URL (e.g. a gateway). */
  baseUrl?: string;
  maxTokens?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class GitHubModelsProvider implements ModelProvider {
  readonly provider = "github_models";
  readonly modelKey: string;
  private readonly explicitKey?: string;
  private readonly url: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: GitHubModelsProviderOptions = {}) {
    this.modelKey = opts.modelKey ?? DEFAULT_GITHUB_MODEL;
    this.explicitKey = opts.apiKey;
    this.url = `${(opts.baseUrl ?? GITHUB_MODELS_BASE_URL).replace(/\/+$/, "")}/chat/completions`;
    this.defaultMaxTokens = opts.maxTokens ?? 1024;
  }

  private resolveKey(): string {
    const key = this.explicitKey ?? process.env.GITHUB_MODELS_TOKEN;
    if (!key) {
      throw new Error(
        `GitHub Models '${this.modelKey}' is not usable: GITHUB_MODELS_TOKEN is not set ` +
          `(a GitHub token with the 'models: read' permission). Refusing to substitute another model.`,
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
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.modelKey,
        max_tokens: maxTokens,
        messages,
        ...(request.outputSchema ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new Error(`GitHub Models API error ${res.status} for '${this.modelKey}': ${detail}`);
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
      // publisher/model names aren't in the pricing tables; cost resolves to 0
      // (never fabricated). GitHub Models is rate-limited rather than billed.
      costUsd: computeCostUsd("github_models", this.modelKey, promptTokens, completionTokens),
      provider: this.provider,
      modelKey: this.modelKey,
    };
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("GitHub Models response was expected to be JSON but could not be parsed.");
  }
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}
