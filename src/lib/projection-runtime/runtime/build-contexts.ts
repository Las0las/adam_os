// build-contexts — server helper that adapts the platform ActorContext into the
// four Universal Projection Runtime contexts. Keeping this adapter in one place
// means surfaces never assemble contexts by hand, and the runtime stays decoupled
// from how auth/session is resolved.

import "server-only";

import type { ActorContext } from "@/types/platform";
import type {
  PermissionContext,
  PolicyContext,
  RuntimeContext,
  UserContext,
  ObjectInstanceSnapshot,
} from "../contracts/context";
import type { SurfaceKind } from "../contracts/projection-definition";
import type { ResolveByIdContexts } from "../registry/projection-resolver";

export interface BuildContextsOptions {
  /** Override the resolved surface (e.g. render the same projection as a page). */
  surfaceOverride?: SurfaceKind;
  /** Bound instance for edit/view projections. */
  instance?: ObjectInstanceSnapshot | null;
  /** Governance posture overrides. */
  policy?: PolicyContext;
  now?: string;
}

/** Build the four runtime contexts from a platform ActorContext. */
export function buildContexts(
  actor: ActorContext,
  options: BuildContextsOptions = {},
): ResolveByIdContexts {
  const userContext: UserContext = {
    tenantId: actor.tenantId,
    userId: actor.actorUserId ?? null,
  };
  const permissionContext: PermissionContext = {
    permissions: actor.permissions,
  };
  const policyContext: PolicyContext = options.policy ?? {};
  const runtimeContext: RuntimeContext = {
    now: options.now ?? new Date().toISOString(),
    surfaceOverride: options.surfaceOverride,
    instance: options.instance ?? null,
  };
  return { userContext, permissionContext, policyContext, runtimeContext };
}
