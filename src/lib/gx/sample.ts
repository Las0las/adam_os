// L1 — RFC-C0-X · the live model for the Governed Execution surface.
//
// Bundles everything the /governed-execution page projects: the normative
// lifecycle phases, the law-conformance findings, and the three representative
// executions that proved them (a granted multi-step run, a denied run, and a
// partial run with a failing step). Exercises the REAL runtime — it owns no
// state and renders only what actually happened.

import { EXECUTION_LIFECYCLE, type ExecutionPhase, type LawConformance, type GovernedExecution } from "./contracts";
import { verifyExecutionLifecycle } from "./conformance";
import { executionCount } from "./execution-record";

export interface GovernedExecutionModel {
  lifecycle: readonly ExecutionPhase[];
  findings: LawConformance[];
  conformant: boolean;
  granted: GovernedExecution;
  denied: GovernedExecution;
  failing: GovernedExecution;
  /** Total governed executions recorded process-wide (append-only). */
  totalRecorded: number;
}

/** One short, human-readable caption per lifecycle phase. */
export const PHASE_CAPTION: Record<ExecutionPhase, string> = {
  intent: "A request to act is received.",
  plan: "An explicit objective, strategy, and expected outcome are fixed.",
  govern: "Real execution authority is spent; a denial halts here.",
  execute: "The planned strategy steps run under that authority.",
  observe: "Six dimensions of evidence are captured from the canonical journal.",
  evaluate: "An objective evaluation enters the permanent record.",
  learn: "Signals are derived to inform future planning.",
  optimize: "A new strategy is proposed — history is never rewritten.",
};

export function liveGovernedExecutionModel(now: number = Date.UTC(2026, 6, 1)): GovernedExecutionModel {
  const { findings, granted, denied, failing } = verifyExecutionLifecycle(now);
  return {
    lifecycle: EXECUTION_LIFECYCLE,
    findings,
    conformant: findings.every((f) => f.satisfied),
    granted,
    denied,
    failing,
    totalRecorded: executionCount(),
  };
}
