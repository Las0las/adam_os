// L0 — Enterprise Constitution (root runtime). Public surface.
export type {
  Constitution,
  ConstitutionActionKind,
  ConstitutionActor,
  ConstitutionContext,
  ConstitutionDecision,
  ConstitutionViolation,
  ConstitutionSeverity,
  ConstitutionAmendment,
  DecisionOutcome,
  EnterpriseIdentity,
  EvidenceItem,
  EvidenceKind,
  Mission,
  MissionObjective,
  Principle,
  PrincipalKind,
  Right,
  Responsibility,
  Invariant,
  Policy,
  PolicyEffect,
  PolicyEvaluation,
} from "./contracts";
export { RESOLVED_PRINCIPAL_KINDS } from "./contracts";
export { LAWRENCE_CONSTITUTION } from "./constitution";
export { decide } from "./evaluation-engine";
export {
  ConstitutionRuntime,
  ConstitutionViolationError,
  assertCompliant,
  evaluate,
  getConstitution,
} from "./constitution-runtime";
export {
  CONSTITUTION_GOVERNANCE_POLICY_ID,
  registerConstitutionGovernancePolicy,
} from "./governance-binding";
export {
  CONSTITUTION_LENSES,
  projectHeadline,
  summarizeDecision,
} from "./projection";
export type { ConstitutionLens, ConstitutionHeadline, DecisionSummary } from "./projection";
