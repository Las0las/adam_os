// L1 — RFC-C0-X · Governed Execution Lifecycle. Public surface.
//
// Intent → Plan → Govern → Execute → Observe → Evaluate → Learn → Optimize.
// Composes the L0 kernel into the normative execution lifecycle and enforces the
// six constitutional laws (C0-X.1 … C0-X.6). Everything is pure, deterministic,
// and serializable.

export type {
  ExecutionPhase,
  ExecutionObjective,
  StepExecutionMode,
  StrategyStep,
  ExecutionStrategy,
  ExecutionPlan,
  StepStatus,
  StepOutcome,
  ObservedEvidence,
  EvaluationOutcome,
  RiskBand,
  ExecutionEvaluation,
  LearningSignal,
  ExecutionStatus,
  GovernedExecution,
  ConstitutionalLaw,
  LawConformance,
} from "./contracts";
export { EXECUTION_LIFECYCLE } from "./contracts";

export { planExecution, runGovernedExecution } from "./runtime";
export type { RunInput } from "./runtime";

export {
  appendExecution,
  getExecutions,
  getExecutionsDescending,
  executionCount,
  subscribeExecutions,
  replayExecutions,
} from "./execution-record";

export { verifyExecutionLifecycle } from "./conformance";

export { liveGovernedExecutionModel, PHASE_CAPTION } from "./sample";
export type { GovernedExecutionModel } from "./sample";
