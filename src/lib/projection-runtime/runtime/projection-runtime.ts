// ProjectionRuntime — the public facade. Accepts exactly the six inputs from the
// contract (enterpriseObject, projectionDefinition, userContext,
// permissionContext, policyContext, runtimeContext) and returns a
// UniversalProjection. It delegates to the composer; no business logic lives in
// any UI component.

import type { UniversalProjection } from "../contracts/universal-projection";
import { compose, type ComposeInput } from "./projection-composer";

export type ResolveInput = ComposeInput;

export const ProjectionRuntime = {
  /** Resolve a fully-composed, serializable UniversalProjection. */
  resolve(input: ResolveInput): UniversalProjection {
    return { plan: compose(input) };
  },
};
