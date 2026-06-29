// LifecycleEngine — resolves the initial state for a create projection and the
// set of legal transitions from a current state. Lifecycle rules live in the
// object metadata; this engine reads them so neither the renderer nor the action
// handler hardcodes a state machine.

import type {
  EnterpriseObjectDefinition,
  LifecycleTransition,
} from "../contracts/enterprise-object";

/** The declared initial state value, or null if the object has no lifecycle. */
export function initialState(object: EnterpriseObjectDefinition): string | null {
  const states = object.lifecycle?.states ?? [];
  const initial = states.find((s) => s.initial) ?? states[0];
  return initial?.value ?? null;
}

/** Legal transitions out of `from`. Empty when there is no lifecycle. */
export function allowedTransitions(
  object: EnterpriseObjectDefinition,
  from: string | null | undefined,
): LifecycleTransition[] {
  if (!object.lifecycle || from == null) return [];
  return object.lifecycle.transitions.filter((t) => t.from === from);
}

/** Whether a transition to `to` is reachable from `from`. */
export function canTransition(
  object: EnterpriseObjectDefinition,
  from: string | null | undefined,
  to: string,
): boolean {
  return allowedTransitions(object, from).some((t) => t.to === to);
}
