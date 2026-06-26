// Real Google Gemini model adapter (§31–§32). Implements the provider-agnostic
// ModelProvider interface using the Generative Language `generateContent` REST
// API over HTTPS. Fail-closed: with no API key it throws clearly rather than
// degrading to a mock or substituting another model.
//
// Uses the platform global `fetch` (undici) — no SDK dependency. JSON output is
// requested via generationConfig.responseMimeType, matching the other adapters'
// schema-constrained mode.

import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { computeCostUsd } from "../model-pricing";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Default chat/extraction model unless a model key is supplied. */
export const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash";

export interface GoogleProviderOptions {
  modelKey?: string;
  apiKey?: string;
  /** Override the base URL (e.g. a proxy/gateway). */
  baseUrl?: string;
  maxTokens?: number;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GoogleModelProvider implements ModelProvider {
  readonly provider = "google";
  readonly modelKey: string;
  private readonly explicitKey?: string;
  private readonly baseUrl: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: GoogleProviderOptions = {}) {
    this.modelKey = opts.modelKey ?? DEFAULT_GOOGLE_MODEL;
    this.explicitKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? GEMINI_BASE_URL;
    this.defaultMaxTokens = opts.maxTokens ?? 1024;
  }

  private resolveKey(): string {
    const key = this.explicitKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        `Google model '${this.modelKey}' is not usable: GOOGLE_API_KEY (or GEMINI_API_KEY) is not set. ` +
          `Refusing to substitute another model — set the key or configure a different provider.`,
      );
    }
    return key;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.resolveKey();
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const prompt = request.outputSchema
      ? "Respond with a single valid JSON object conforming to this JSON schema: " +
        `${JSON.stringify(request.outputSchema)}\n\n${request.prompt}`
      : request.prompt;

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(request.outputSchema ? { responseMimeType: "application/json" } : {}),
      },
    };

    const startedAt = Date.now();
    const res = await fetch(`${this.baseUrl}/${this.modelKey}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new Error(`Google API error ${res.status} for '${this.modelKey}': ${detail}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const latencyMs = Date.now() - startedAt;

    const text = (data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

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
    throw new Error("Google response was expected to be JSON but could not be parsed.");
  }
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}
