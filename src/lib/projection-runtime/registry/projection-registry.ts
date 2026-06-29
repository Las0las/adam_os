// ProjectionRegistry — the single source of truth mapping objectType →
// EnterpriseObjectDefinition and projectionId → ProjectionDefinition. Definitions
// self-register on import (mirroring the action-engine builtin pattern), so
// adding a new object or surface is a metadata change, not a code change in any
// renderer.

import type { EnterpriseObjectDefinition } from "../contracts/enterprise-object";
import type { ProjectionDefinition } from "../contracts/projection-definition";

const objects = new Map<string, EnterpriseObjectDefinition>();
const projections = new Map<string, ProjectionDefinition>();

export function registerEnterpriseObject(def: EnterpriseObjectDefinition): void {
  objects.set(def.objectType, def);
}

export function registerProjection(def: ProjectionDefinition): void {
  if (!objects.has(def.objectType)) {
    // Fail-soft: register anyway; the resolver reports the missing object def.
  }
  projections.set(def.id, def);
}

export function getEnterpriseObject(objectType: string): EnterpriseObjectDefinition | undefined {
  return objects.get(objectType);
}

export function getProjection(projectionId: string): ProjectionDefinition | undefined {
  return projections.get(projectionId);
}

export function listProjections(filter?: {
  objectType?: string;
  surface?: ProjectionDefinition["surface"];
}): ProjectionDefinition[] {
  let all = [...projections.values()];
  if (filter?.objectType) all = all.filter((p) => p.objectType === filter.objectType);
  if (filter?.surface) all = all.filter((p) => p.surface === filter.surface);
  return all;
}

export function listEnterpriseObjects(): EnterpriseObjectDefinition[] {
  return [...objects.values()];
}
