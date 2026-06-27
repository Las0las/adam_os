// IOS-014 — Benchmark Harness — deterministic scoring.
//
// Pure, deterministic mapping from (strategy, case, execution outcome) to a
// normalized score in [0, 1]. No randomness, no LLM-based grading (out of scope).
// A failed execution always scores 0.

import type { BenchmarkCase, ScoringStrategy } from "./benchmark-types";

/** The minimal execution outcome the scorer reads (from the pipeline result). */
export interface ScoredOutcome {
  success: boolean;
  response: string | null;
  json: Record<string, unknown> | null;
}

export function scoreCase(strategy: ScoringStrategy, c: BenchmarkCase, outcome: ScoredOutcome): number {
  if (!outcome.success) return 0;
  switch (strategy) {
    case "success":
      return 1;
    case "exact_match":
      return outcome.response === (c.scoringMetadata?.expected ?? null) ? 1 : 0;
    case "contains":
      return (outcome.response ?? "").includes(c.scoringMetadata?.expected ?? "") ? 1 : 0;
    case "json_keys": {
      const keys = c.scoringMetadata?.expectedKeys ?? Object.keys(c.expectedOutputShape ?? {});
      const obj = outcome.json;
      if (!obj || keys.length === 0) return 0;
      return keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k)) ? 1 : 0;
    }
  }
}
