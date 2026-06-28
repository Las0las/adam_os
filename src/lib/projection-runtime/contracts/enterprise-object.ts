// Universal Projection Runtime — EnterpriseObject metadata contracts.
//
// An EnterpriseObjectDefinition is the single, surface-independent description of
// a domain object: its fields, object-level invariants, lifecycle, the governed
// domain intents it can emit, and the post-intent follow-up actions. Critically,
// it owns NO presentation: a projection (modal/drawer/grid/...) references this
// definition but never changes it. This is what lets "Candidate" be rendered as
// a modal today and a graph node later without touching the object definition.

import type { Permission } from "@/types/platform";
import type { FieldDefinition } from "./field";

/** Cross-field / whole-object invariant (e.g. "at least one of A or B"). */
export interface ObjectValidationRule {
  /** `anyOf`: at least one of `fields` must be present/non-empty. */
  kind: "anyOf";
  fields: string[];
  message: string;
}

/** One lifecycle state in the object's state machine. */
export interface LifecycleState {
  value: string;
  label: string;
  initial?: boolean;
  terminal?: boolean;
}

/** A governed lifecycle transition, emitted as a domain intent. */
export interface LifecycleTransition {
  from: string;
  to: string;
  /** The domain intent that performs this transition. */
  intent: string;
  label: string;
}

/** Declarative state machine for the object. */
export interface LifecycleDefinition {
  states: LifecycleState[];
  transitions: LifecycleTransition[];
}

/** Semantics of an intent's effect on the object. */
export type IntentOperation = "create" | "update" | "transition" | "delete" | "custom";

/**
 * A governed domain intent. Actions in the UI NEVER mutate records directly —
 * they emit one of these. Every intent maps to a registered action-engine
 * handler (`actionKey`), so emission flows through the existing governance
 * pipeline (idempotency → permission → object ACL → precondition → approval →
 * run → audit). The intent `name` is the domain verb (e.g.
 * "Candidate.CreateRequested"); `actionKey` is the engine handler it resolves to.
 */
export interface IntentDefinition {
  name: string;
  operation: IntentOperation;
  actionKey: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** Permission required to OFFER/emit the intent (PermissionEngine gate). */
  requiredPermission?: Permission;
  /** Whether emission routes through human approval (PolicyEngine hint). */
  requiresApproval?: boolean;
}

/** A follow-up action performed by the renderer AFTER an intent succeeds. These
 *  are declarative and surface-agnostic (e.g. navigate to the new record). */
export interface PostActionDefinition {
  kind: "navigate" | "toast" | "emitIntent";
  /** For `navigate`: an href template; `{id}` is replaced with the result id,
   *  `{objectType}` with the object type. */
  href?: string;
  /** For `toast`: the message template. */
  message?: string;
  /** For `emitIntent`: the chained intent name. */
  intent?: string;
  /** Only run this post-action for these intent operations (default: all). */
  forOperations?: IntentOperation[];
}

/** The canonical, presentation-free definition of an enterprise object. */
export interface EnterpriseObjectDefinition {
  /** Canonical ontology objectType, e.g. "Candidate". */
  objectType: string;
  displayName: string;
  pluralName: string;
  /** Field whose value derives the object title (falls back at bind time). */
  titleField?: string;
  fields: FieldDefinition[];
  objectValidations?: ObjectValidationRule[];
  lifecycle?: LifecycleDefinition;
  intents: IntentDefinition[];
  postActions?: PostActionDefinition[];
}
