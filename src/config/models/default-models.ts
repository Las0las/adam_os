// Default model registry config (§32, Phase 2 §57). Mirrors db/seeds/seed_models.sql.

export const DEFAULT_MODEL_KEYS = {
  chatPrimary: "anthropic-sonnet",
  extractionPrimary: "gpt-4.1-mini",
  embeddingPrimary: "text-embedding-3-large",
} as const;

export const DEFAULT_MODELS = [
  { key: "chat-primary", provider: "anthropic", modelKey: "claude-sonnet", purpose: "chat" },
  { key: "extraction-primary", provider: "openai", modelKey: "gpt-4.1-mini", purpose: "extraction" },
  { key: "embedding-primary", provider: "openai", modelKey: "text-embedding-3-large", purpose: "embedding" },
] as const;
