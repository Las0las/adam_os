// Phase 10 — access guard facade. Single import surface for services that need
// to enforce object access from an ActorContext.

import { securityContextFromActor } from "./security-context-service";
import {
  AccessDeniedError,
  checkObjectAccess,
  enforceObjectAccess,
  type ObjectAccessInput,
} from "./object-access-service";
import type { ActorContext } from "@/types/platform";
import type { AccessDecision } from "./access-control-types";

export { AccessDeniedError };

/** Enforce object access using the permissions already on an ActorContext. */
export async function enforceObjectAccessForActor(
  ctx: ActorContext,
  input: ObjectAccessInput,
): Promise<AccessDecision> {
  return await enforceObjectAccess(securityContextFromActor(ctx), input);
}

export async function checkObjectAccessForActor(
  ctx: ActorContext,
  input: ObjectAccessInput,
): Promise<AccessDecision> {
  return await checkObjectAccess(securityContextFromActor(ctx), input);
}
