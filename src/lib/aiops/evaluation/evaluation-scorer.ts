// IOS-017 — Evaluation Engine — deterministic scoring.
//
// Pure mapping from (criteria, subject) to per-criterion outcomes, a normalized
// score (fraction of criteria passed), and an overall pass (all criteria passed).
// No randomness, no LLM-based grading.

import type { CriterionOutcome, EvaluationCriterion, EvaluationSubject } from "./evaluation-types";

function evalCriterion(c: EvaluationCriterion, s: EvaluationSubject): boolean {
  switch (c.type) {
    case "must_succeed":
      return s.success;
    case "max_latency": {
      const limit = typeof c.value === "number" ? c.value : s.expected?.maxLatencyMs ?? Infinity;
      return s.latencyMs <= limit;
    }
    case "no_fallback":
      return !s.fallbackOccurred;
    case "output_equals": {
      const expected = typeof c.value === "string" ? c.value : s.expected?.outputEquals ?? null;
      return s.response === expected;
    }
    case "output_contains": {
      const needle = typeof c.value === "string" ? c.value : s.expected?.outputContains ?? "";
      return (s.response ?? "").includes(needle);
    }
  }
}

export function scoreSubject(
  criteria: EvaluationCriterion[],
  subject: EvaluationSubject,
): { passed: boolean; score: number; outcomes: CriterionOutcome[] } {
  if (criteria.length === 0) return { passed: true, score: 1, outcomes: [] };
  const outcomes = criteria.map((c) => ({ type: c.type, passed: evalCriterion(c, subject) }));
  const passedCount = outcomes.filter((o) => o.passed).length;
  return { passed: passedCount === outcomes.length, score: passedCount / outcomes.length, outcomes };
}
