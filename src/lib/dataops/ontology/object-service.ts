// Ontology object + link persistence (§20–§21). The ontology is the operating
// surface; upserts are keyed on (objectType, externalKey) for idempotent merges.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject, OntologyLink } from "@/types/dataops";

export interface UpsertObjectInput {
  objectType: string;
  externalKey?: string | null;
  title?: string | null;
  status?: string | null;
  properties?: Record<string, unknown>;
}

export function upsertObject(ctx: ActorContext, input: UpsertObjectInput): OntologyObject {
  requirePermission(ctx, "ontology.admin");
  const existing = input.externalKey
    ? db.ontologyObjects.find(
        ctx.tenantId,
        (o) => o.objectType === input.objectType && o.externalKey === input.externalKey,
      )
    : undefined;

  if (existing) {
    const merged = db.ontologyObjects.update(existing.id, {
      title: input.title ?? existing.title,
      status: input.status ?? existing.status,
      properties: { ...existing.properties, ...(input.properties ?? {}) },
      updatedAt: now(),
    });
    recordHistory(ctx, merged, "update");
    return merged;
  }

  const ts = now();
  const created = db.ontologyObjects.insert({
    id: id("obj"),
    tenantId: ctx.tenantId,
    objectType: input.objectType,
    externalKey: input.externalKey ?? null,
    title: input.title ?? null,
    status: input.status ?? null,
    properties: input.properties ?? {},
    createdAt: ts,
    updatedAt: ts,
  });
  recordHistory(ctx, created, "create");
  return created;
}

export function linkObjects(
  ctx: ActorContext,
  input: {
    linkType: string;
    from: { objectType: string; objectId: string };
    to: { objectType: string; objectId: string };
    properties?: Record<string, unknown>;
  },
): OntologyLink {
  requirePermission(ctx, "ontology.admin");
  const existing = db.ontologyLinks.find(
    ctx.tenantId,
    (l) =>
      l.linkType === input.linkType &&
      l.fromObjectId === input.from.objectId &&
      l.toObjectId === input.to.objectId,
  );
  if (existing) return existing;

  return db.ontologyLinks.insert({
    id: id("link"),
    tenantId: ctx.tenantId,
    linkType: input.linkType,
    fromObjectType: input.from.objectType,
    fromObjectId: input.from.objectId,
    toObjectType: input.to.objectType,
    toObjectId: input.to.objectId,
    properties: input.properties,
    createdAt: now(),
  });
}

export function listObjects(ctx: ActorContext, objectType?: string): OntologyObject[] {
  return db.ontologyObjects.list(ctx.tenantId, objectType ? (o) => o.objectType === objectType : undefined);
}

export function linksFor(ctx: ActorContext, objectId: string): OntologyLink[] {
  return db.ontologyLinks.list(
    ctx.tenantId,
    (l) => l.fromObjectId === objectId || l.toObjectId === objectId,
  );
}

function recordHistory(ctx: ActorContext, obj: OntologyObject, kind: "create" | "update"): void {
  emitAudit(ctx, `ontology.object.${kind}`, { type: obj.objectType, id: obj.id }, {
    objectType: obj.objectType,
    externalKey: obj.externalKey,
  });
}
