// Real Azure OpenAI model adapter (§31–§32). Azure OpenAI speaks the OpenAI Chat
// Completions wire contract, but with a different shape:
//   - URL routes by DEPLOYMENT name, not model name:
//       {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...
//   - auth is the `api-key` header, not `Authorization: Bearer`.
// So it cannot reuse the public-OpenAI adapter as-is (which would silently call
// api.openai.com). Fail-closed: missing key OR endpoint throws clearly.
//
// Uses the platform global `fetch` (undici) — no SDK dependency.

import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { computeCostUsd } from "../model-pricing";

/** Pinned default REST API version (stable GA). Override via env/opts. */
export const DEFAULT_AZURE_API_VERSION = "2024-10-21";

export interface AzureOpenAIProviderOptions {
  /** Azure deployment name (this is the modelKey for routing). */
  deployment?: string;
  apiKey?: string;
  /** Resource endpoint, e.g. https://my-resource.openai.azure.com */
  endpoint?: string;
  apiVersion?: string;
  maxTokens?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class AzureOpenAIModelProvider implements ModelProvider {
  readonly provider = "azure_openai";
  /** For Azure the modelKey is the deployment name. */
  readonly modelKey: string;
  private readonly explicitKey?: string;
  private readonly explicitEndpoint?: string;
  private readonly apiVersion: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: AzureOpenAIProviderOptions = {}) {
    this.modelKey = opts.deployment ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? "";
    this.explicitKey = opts.apiKey;
    this.explicitEndpoint = opts.endpoint;
    this.apiVersion = opts.apiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_AZURE_API_VERSION;
    this.defaultMaxTokens = opts.maxTokens ?? 1024;
  }

  private resolveKey(): string {
    const key = this.explicitKey ?? process.env.AZURE_OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        `Azure OpenAI deployment '${this.modelKey}' is not usable: AZURE_OPENAI_API_KEY is not set. ` +
          `Refusing to substitute another model — set the key or configure a different provider.`,
      );
    }
    return key;
  }

  private resolveEndpoint(): string {
    const endpoint = this.explicitEndpoint ?? process.env.AZURE_OPENAI_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        `Azure OpenAI deployment '${this.modelKey}' is not usable: AZURE_OPENAI_ENDPOINT is not set ` +
          `(e.g. https://<resource>.openai.azure.com).`,
      );
    }
    return endpoint.replace(/\/+$/, "");
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.resolveKey();
    const endpoint = this.resolveEndpoint();
    if (!this.modelKey) throw new Error("Azure OpenAI requires a deployment name (modelKey).");
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

    const url =
      `${endpoint}/openai/deployments/${encodeURIComponent(this.modelKey)}/chat/completions` +
      `?api-version=${encodeURIComponent(this.apiVersion)}`;

    const startedAt = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        max_tokens: maxTokens,
        messages,
        ...(request.outputSchema ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new Error(`Azure OpenAI API error ${res.status} for '${this.modelKey}': ${detail}`);
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
      // Deployment names are user-chosen; pricing resolves when the deployment is
      // named like a known model, else 0 (never fabricated).
      costUsd: computeCostUsd("azure_openai", this.modelKey, promptTokens, completionTokens),
      provider: this.provider,
      modelKey: this.modelKey,
    };
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Azure OpenAI response was expected to be JSON but could not be parsed.");
  }
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}
