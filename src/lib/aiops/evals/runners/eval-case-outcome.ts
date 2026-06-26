// Phase 7 — shared per-case eval outcome shape returned by every sub-runner.

export interface CaseOutcome {
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  scores: Record<string, number>;
  /** The headline score (0..1) used for run aggregation + regression. */
  primaryScore: number;
  passed: boolean;
  errors: string[];
  trace: Record<string, unknown>;
}
