// L0 — Enterprise Constitution. Public surface.
export type {
  Constitution,
  ConstitutionActionKind,
  ConstitutionContext,
  ConstitutionVerdict,
  EnterpriseIdentity,
  Mission,
  Principle,
  Right,
  Responsibility,
  Invariant,
  InvariantSeverity,
  InvariantViolation,
  Policy,
} from "./contracts";
export { LAWRENCE_CONSTITUTION } from "./constitution";
export { evaluateConstitution } from "./invariant-engine";
export {
  ConstitutionViolationError,
  assertCompliant,
  evaluate,
  getConstitution,
} from "./constitution-runtime";
export {
  CONSTITUTION_GOVERNANCE_POLICY_ID,
  registerConstitutionGovernancePolicy,
} from "./governance-binding";
