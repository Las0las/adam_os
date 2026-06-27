// ProjectionResolver — the convenience entry point used by surfaces. Given a
// projectionId and the runtime contexts, it looks up both the projection and its
// referenced enterprise object from the registry, then runs the ProjectionRuntime.
// This is what a page/route calls; it never needs to know the object's shape.

import "../definitions/register"; // ensure definitions are registered on import

import type { UniversalProjection } from "../contracts/universal-projection";
import type {
  UserContext,
  PermissionContext,
  PolicyContext,
  RuntimeContext,
} from "../contracts/context";
import { getEnterpriseObject, getProjection } from "./projection-registry";
import { ProjectionRuntime } from "../runtime/projection-runtime";

export class ProjectionResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectionResolutionError";
  }
}

export interface ResolveByIdContexts {
  userContext: UserContext;
  permissionContext: PermissionContext;
  policyContext: PolicyContext;
  runtimeContext: RuntimeContext;
}

/** Resolve a UniversalProjection by projection id. Throws if the projection or
 *  its referenced object definition is not registered. */
export function resolveProjection(
  projectionId: string,
  contexts: ResolveByIdContexts,
): UniversalProjection {
  const projectionDefinition = getProjection(projectionId);
  if (!projectionDefinition) {
    throw new ProjectionResolutionError(`Unknown projection: ${projectionId}`);
  }
  const enterpriseObject = getEnterpriseObject(projectionDefinition.objectType);
  if (!enterpriseObject) {
    throw new ProjectionResolutionError(
      `Projection ${projectionId} references unregistered object: ${projectionDefinition.objectType}`,
    );
  }
  return ProjectionRuntime.resolve({
    enterpriseObject,
    projectionDefinition,
    ...contexts,
  });
}
