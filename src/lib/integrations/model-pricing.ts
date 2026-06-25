// Best-effort per-model pricing (USD per 1M tokens) for cost telemetry on the
// ModelTrace records (§43). These figures are advisory: an unknown model key
// yields a zero cost rather than a fabricated number — we never invent pricing.

export interface TokenPrice {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerMTok: number;
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerMTok: number;
}

const ANTHROPIC_PRICES: Record<string, TokenPrice> = {
  "claude-fable-5": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-mythos-5": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-6": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
};

const OPENAI_PRICES: Record<string, TokenPrice> = {
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  "gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
};

const TABLES: Record<string, Record<string, TokenPrice>> = {
  anthropic: ANTHROPIC_PRICES,
  openai: OPENAI_PRICES,
  azure_openai: OPENAI_PRICES,
};

/** Compute USD cost for a completion; unknown models cost 0 (never fabricated). */
export function computeCostUsd(
  provider: string,
  modelKey: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const price = TABLES[provider]?.[modelKey];
  if (!price) return 0;
  return (
    (promptTokens / 1_000_000) * price.inputPerMTok +
    (completionTokens / 1_000_000) * price.outputPerMTok
  );
}
