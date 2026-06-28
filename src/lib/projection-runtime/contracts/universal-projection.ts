// Universal Projection Runtime — the resolved, serializable output.
//
// A UniversalProjection wraps a RenderPlan: the fully-resolved, plain-data
// instruction set the UI renders. It is the contract between the runtime (which
// owns all business logic) and the renderer (which owns no business logic). It is
// pure JSON so it crosses the server→client boundary and so any surface renderer
// can consume it.

import type { FieldType, FieldValidationRule, FieldOption } from "./field";
import type { ObjectValidationRule, IntentOperation } from "./enterprise-object";
import type { SurfaceKind, ProjectionMode, ProjectionDisplay } from "./projection-definition";

/** A field resolved for a specific surface/mode/user: value bound, visibility
 *  and editability decided, validations flattened. */
export interface ResolvedField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  /** Bound initial value (instance value for edit/view, default for create). */
  value: unknown;
  required: boolean;
  validations: FieldValidationRule[];
  visible: boolean;
  editable: boolean;
  /** Property/title/status binding target, carried through for the payload. */
  binding: { target: "title" | "status" | "property"; path: string };
}

/** A resolved layout section. */
export interface ResolvedSection {
  id: string;
  title?: string;
  description?: string;
  columns: 1 | 2;
  fields: ResolvedField[];
}

/** A resolved, gated intent ready to be emitted by the IntentEmitter. */
export interface ResolvedIntent {
  name: string;
  operation: IntentOperation;
  actionKey: string;
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  requiresApproval: boolean;
  enabled: boolean;
  disabledReason?: string;
}

/** A resolved post-intent follow-up action. */
export interface ResolvedPostAction {
  kind: "navigate" | "toast" | "emitIntent";
  href?: string;
  message?: string;
  intent?: string;
  forOperations?: IntentOperation[];
}

/** Correlation metadata for telemetry. */
export interface ProjectionTelemetry {
  projectionId: string;
  objectType: string;
  surface: SurfaceKind;
  resolvedAt: string;
}

/** The execution authority under which this projection was resolved. Every
 *  projection is rendered against an ExecutionAuthority token issued by the
 *  kernel (built on the Constitution Runtime); this serializable summary carries
 *  that authority to the surface so the UI can attribute and explain it. */
export interface ProjectionAuthority {
  /** The ExecutionAuthority token id issued by the kernel for this resolve. */
  authorityId: string;
  decisionId: string;
  outcome: "authorized" | "denied" | "authorized_with_advice";
  authorized: boolean;
  constitutionVersion: string;
  /** Capabilities the authority grants for this projection. */
  capabilities: string[];
  /** Mission objective this projection best serves, if any. */
  missionObjective?: string;
  /** Plain reasons/restrictions when the projection was not fully authorized. */
  advisories: string[];
}

/** The complete, serializable render plan. */
export interface RenderPlan {
  projectionId: string;
  objectType: string;
  surface: SurfaceKind;
  mode: ProjectionMode;
  title: string;
  description?: string;
  sections: ResolvedSection[];
  objectValidations: ObjectValidationRule[];
  primaryIntent?: ResolvedIntent;
  secondaryIntents: ResolvedIntent[];
  postActions: ResolvedPostAction[];
  display?: ProjectionDisplay;
  telemetry: ProjectionTelemetry;
  /** The constitutional decision that authorized this projection to resolve. */
  authority: ProjectionAuthority;
}

/** The runtime's resolve() output. */
export interface UniversalProjection {
  plan: RenderPlan;
}
