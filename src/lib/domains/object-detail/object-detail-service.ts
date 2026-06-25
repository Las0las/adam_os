// Phase 5 — Object Detail service (Part C2). Assembles the full governed context
// for one object: properties, relationships, evidence, open reviews, runtime
// traces, audit, and available actions. Tenant-scoped throughout.

import { db } from "@/lib/lawrence-core/db";
import { listObjects, linksFor } from "@/lib/dataops/ontology/object-service";
import { availableActionsForObject } from "./available-actions";
import type { ActorContext } from "@/types/platform";
import type { ObjectDetail } from "./object-detail-types";

export class ObjectNotFoundError extends Error {
  constructor(objectType: string, objectId: string) {
    super(`Object not found: ${objectType}/${objectId}`);
    this.name = "ObjectNotFoundError";
  }
}

/** True if any value in `input` references the object id (for trace matching). */
function inputReferences(input: Record<string, unknown>, objectId: string): boolean {
  return Object.values(input).some((v) => v === objectId);
}

export async function getObjectDetail(
  ctx: ActorContext,
  objectType: string,
  objectId: string,
): Promise<ObjectDetail> {
  const object = await db.ontologyObjects.get(ctx.tenantId, objectId);
  if (!object || object.objectType !== objectType) {
    throw new ObjectNotFoundError(objectType, objectId);
  }

  // Relationships (both directions), titles resolved.
  const links = await linksFor(ctx, objectId);
  const relationships = await Promise.all(
    links.map(async (l) => {
      const outbound = l.fromObjectId === objectId;
      const otherType = outbound ? l.toObjectType : l.fromObjectType;
      const otherId = outbound ? l.toObjectId : l.fromObjectId;
      const other = await db.ontologyObjects.get(ctx.tenantId, otherId);
      return {
        linkType: l.linkType,
        direction: (outbound ? "outbound" : "inbound") as "inbound" | "outbound",
        objectType: otherType,
        objectId: otherId,
        title: other?.title ?? null,
      };
    }),
  );

  // Evidence linked directly to the object.
  const chunks = await db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === objectId);
  const evidence = chunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((c) => ({
      objectType: c.sourceObjectType,
      objectId: c.sourceObjectId,
      chunkId: c.id,
      excerpt: c.text.slice(0, 280),
      score: null,
      method: null,
      metadata: { chunkIndex: c.chunkIndex },
    }));

  // Open reviews for this subject.
  const reviews = (
    await db.reviewCases.list(ctx.tenantId, (c) => c.subjectObjectId === objectId)
  ).map((c) => ({
    id: c.id,
    status: c.status,
    severity: c.severity ?? null,
    summary: c.summary ?? null,
    createdAt: c.createdAt,
  }));

  // Traces: action executions on this object + function/agent runs referencing it.
  const actionRuns = await db.actionExecutions.list(ctx.tenantId, (a) => a.objectId === objectId);
  const fnRuns = await db.functionRuns.list(ctx.tenantId, (r) => inputReferences(r.input, objectId));
  const agentRuns = await db.agentRuns.list(ctx.tenantId, (r) => inputReferences(r.input, objectId));
  const traces: ObjectDetail["traces"] = [
    ...actionRuns.map((a) => ({
      runType: "action" as const,
      runId: a.id,
      status: a.status,
      summary: a.actionId,
      createdAt: a.createdAt,
    })),
    ...fnRuns.map((r) => ({
      runType: "function" as const,
      runId: r.id,
      status: r.status,
      summary: r.functionId,
      createdAt: r.createdAt,
    })),
    ...agentRuns.map((r) => ({
      runType: "agent" as const,
      runId: r.id,
      status: r.status,
      summary: r.agentId,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Audit for this object.
  const audit = (await db.auditEvents.list(ctx.tenantId, (e) => e.subjectId === objectId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      id: e.id,
      eventType: e.action,
      actor: e.actorUserId ?? null,
      createdAt: e.createdAt,
      payload: e.metadata,
    }));

  const actions = availableActionsForObject(objectType, object.status).map((a) => ({
    ...a,
    input: { ...a.input, objectType, objectId },
  }));

  return {
    object: {
      objectType: object.objectType,
      objectId: object.id,
      title: object.title,
      status: object.status,
      properties: object.properties,
      createdAt: object.createdAt,
      updatedAt: object.updatedAt,
    },
    relationships,
    evidence,
    actions,
    reviews,
    traces,
    audit,
  };
}

/** Resolve a single run's trace detail (Part M: GET /api/traces/:runType/:runId). */
export async function getRunTrace(
  ctx: ActorContext,
  runType: "function" | "agent" | "action",
  runId: string,
): Promise<Record<string, unknown> | null> {
  if (runType === "function") {
    const r = await db.functionRuns.get(ctx.tenantId, runId);
    if (!r) return null;
    return { runType, runId, status: r.status, output: r.output, citations: r.citations ?? [], input: r.input };
  }
  if (runType === "agent") {
    const r = await db.agentRuns.get(ctx.tenantId, runId);
    if (!r) return null;
    return { runType, runId, status: r.status, output: r.output, steps: r.steps, input: r.input };
  }
  const r = await db.actionExecutions.get(ctx.tenantId, runId);
  if (!r) return null;
  return { runType, runId, status: r.status, result: r.result, input: r.input, blockedReason: r.blockedReason };
}
