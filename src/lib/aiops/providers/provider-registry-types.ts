// Provider Platform — canonical types (Milestone 2.0).
//
// The registry is the single source of truth for what providers and models
// exist, how they authenticate, what they cost, and what they can do. Routing,
// governance, evaluation and optimization will depend on these contracts.
//
// Capabilities are DECLARED per model (never inferred from a provider's name).

import type { ModelProvider } from "@/lib/aiops/models/model-provider";

/** Normalized feature flags for a single model. */
export interface CapabilitySet {
  vision: boolean;
  tools: boolean;
  streaming: boolean;
  json: boolean;
  reasoning: boolean;
  embeddings: boolean;
}

/** USD per 1,000,000 tokens. Null when a provider does not publish pricing
 *  (e.g. usage-named deployments, rate-limited tiers) — never fabricated. */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

/** Canonical, provider-agnostic description of one model. */
export interface ModelDescriptor {
  /** Registry provider id, e.g. "openai", "azure_openai", "github_models". */
  provider: string;
  /** Who authored the weights, e.g. "openai", "anthropic", "meta", "mistral-ai". */
  publisher: string;
  /** Model family, e.g. "gpt-4.1", "claude-opus", "gemini-2.0". */
  family: string;
  /** Canonical model/deployment key used to invoke it. */
  model: string;
  version: string | null;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsJSON: boolean;
  supportsReasoning: boolean;
  supportsEmbeddings: boolean;
  pricing: ModelPricing | null;
  deprecated: boolean;
}

export type ProviderAuthType = "bearer" | "api-key" | "header-token" | "none";

/** Normalized, static metadata about a provider (not its models). */
export interface ProviderMetadata {
  id: string;
  vendor: string;
  displayName: string;
  authType: ProviderAuthType;
  endpoint: string;
  supportsBatch: boolean;
  supportsStreaming: boolean;
}

export type ProviderHealthStatus = "unknown" | "healthy" | "degraded" | "unavailable";

/** Normalized provider-health contract. Monitoring is NOT implemented in this
 *  milestone — this only establishes the shape downstream code will consume. */
export interface ProviderHealth {
  provider: string;
  status: ProviderHealthStatus;
  checkedAt: string | null;
  latencyMsP50: number | null;
  detail: string | null;
}

/** A registered provider: metadata + published descriptors + how to build an
 *  adapter and whether it is configured. Env is read lazily (at call time) so
 *  configuration changes are always respected. */
export interface RegisteredProvider {
  metadata: ProviderMetadata;
  descriptors: ModelDescriptor[];
  /** AND-of-OR groups of env var names required to authenticate (per-tenant). */
  requiredEnv: string[][];
  /** Additional env groups needed only to act as the PROCESS DEFAULT. */
  extraDefaultEnv?: string[][];
  /** Lower = higher preference when picking the process default. */
  defaultPriority: number;
  /** True when the required env is present (authorizable per-tenant). */
  isConfigured(): boolean;
  /** True when eligible to be the process default (requiredEnv + extraDefaultEnv). */
  isDefaultEligible(): boolean;
  /** Build an adapter for a specific model/deployment key. */
  create(modelKey: string): ModelProvider;
  /** Build the process-default adapter (uses env default model/deployment). */
  createDefault(): ModelProvider;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Project a descriptor's declared flags into a normalized CapabilitySet.
 *  Derived ONLY from the descriptor — never from the provider name. */
export function capabilitySetOf(d: ModelDescriptor): CapabilitySet {
  return {
    vision: d.supportsVision,
    tools: d.supportsTools,
    streaming: d.supportsStreaming,
    json: d.supportsJSON,
    reasoning: d.supportsReasoning,
    embeddings: d.supportsEmbeddings,
  };
}

/** True if at least one env var in each group is set. */
export function envSatisfied(groups: string[][]): boolean {
  return groups.every((group) => group.some((name) => Boolean(process.env[name])));
}

/** Human-readable env requirement for fail-closed messages, e.g.
 *  "GOOGLE_API_KEY or GEMINI_API_KEY" / "AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT". */
export function describeRequiredEnv(groups: string[][]): string {
  return groups.map((group) => group.join(" or ")).join(" and ");
}

/** The unknown-health value (no monitoring performed). */
export function unknownHealth(provider: string): ProviderHealth {
  return { provider, status: "unknown", checkedAt: null, latencyMsP50: null, detail: null };
}

/** Throw if a descriptor is missing required fields or has wrong-typed flags. */
export function assertValidDescriptor(d: ModelDescriptor): void {
  const req: Array<[string, unknown]> = [
    ["provider", d.provider],
    ["publisher", d.publisher],
    ["family", d.family],
    ["model", d.model],
  ];
  for (const [field, value] of req) {
    if (typeof value !== "string" || value === "") {
      throw new Error(`Invalid ModelDescriptor: '${field}' must be a non-empty string`);
    }
  }
  if (typeof d.contextWindow !== "number" || d.contextWindow <= 0) {
    throw new Error(`Invalid ModelDescriptor '${d.model}': contextWindow must be a positive number`);
  }
  const flags: Array<[string, unknown]> = [
    ["supportsVision", d.supportsVision],
    ["supportsTools", d.supportsTools],
    ["supportsStreaming", d.supportsStreaming],
    ["supportsJSON", d.supportsJSON],
    ["supportsReasoning", d.supportsReasoning],
    ["supportsEmbeddings", d.supportsEmbeddings],
    ["deprecated", d.deprecated],
  ];
  for (const [field, value] of flags) {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid ModelDescriptor '${d.model}': '${field}' must be a boolean`);
    }
  }
}
