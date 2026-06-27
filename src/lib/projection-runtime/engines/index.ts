// Universal Projection Runtime — engines barrel.

export { validateValues, validatePlan } from "./validation-engine";
export type { ValidationViolation, ValidationResult } from "./validation-engine";

export {
  bindingPath,
  readFieldValue,
  toCanonicalPayload,
} from "./binding-engine";
export type { CanonicalUpsertPayload } from "./binding-engine";

export { hasPermission, canEmitIntent } from "./permission-engine";
export type { IntentPermissionDecision } from "./permission-engine";

export { evaluateIntentPolicy } from "./policy-engine";
export type { IntentPolicyDecision } from "./policy-engine";

export { composeSections } from "./layout-engine";

export { initialState, allowedTransitions, canTransition } from "./lifecycle-engine";

export { TelemetryEmitter, NOOP_TELEMETRY } from "./telemetry-emitter";
export type { TelemetryEvent } from "./telemetry-emitter";
