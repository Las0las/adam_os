// Ontology object + link persistence (§20–§21). The ontology is the operating
// surface; upserts are keyed on (objectType, externalKey) for idempotent merges.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { schemaFor } from "./schemas/registry";
import { validateCanonicalObject } from "./schemas/validate";
import { resolveEnforcementMode } from "./schemas/enforcement";
import { OntologySchemaError } from "./schemas/errors";
import { validateRelationship } from "./relationships/validate";
import type { CanonicalObjectInput, Violation } from "./schemas/types";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject, OntologyLink } from "@/types/dataops";

/** An append-only ledger entry to merge into a property. The entry is appended
 *  to the array at `properties[prop]`, preserving every prior entry — existing
 *  entries are never mutated or dropped. `dedupeKey` makes the append idempotent:
 *  if an entry with the same value at `entry[dedupeKey]` already exists, nothing
 *  is appended (so re-running one import, which upserts the same object many
 *  times, records exactly one ledger entry per import run). */
export interface AppendLedgerEntry {
  prop: string;
  entry: Record<string, unknown>;
  dedupeKey: string;
}

export interface UpsertObjectInput {
  objectType: string;
  externalKey?: string | null;
  title?: string | null;
  status?: string | null;
  properties?: Record<string, unknown>;
  /** Immutable append-only ledgers (e.g. ingestion provenance history). Applied
   *  after the scalar `properties` merge, reading prior entries from the existing
   *  object so the ledger only ever grows. */
  appendLedger?: AppendLedgerEntry[];
}

/** Append ledger entries onto `base`, reading prior arrays from `prior` so the
 *  scalar property merge cannot clobber an existing ledger. */
function applyLedgers(
  base: Record<string, unknown>,
  prior: Record<string, unknown>,
  ledgers: AppendLedgerEntry[] | undefined,
): Record<string, unknown> {
  if (!ledgers || ledgers.length === 0) return base;
  const out = { ...base };
  for (const { prop, entry, dedupeKey } of ledgers) {
    const existingArr = Array.isArray(prior[prop]) ? (prior[prop] as unknown[]) : [];
    const key = entry[dedupeKey];
    const present = existingArr.some(
      (e) => e != null && typeof e === "object" && (e as Record<string, unknown>)[dedupeKey] === key,
    );
    out[prop] = present ? existingArr : [...existingArr, entry];
  }
  return out;
}

export async function upsertObject(ctx: ActorContext, input: UpsertObjectInput): Promise<OntologyObject> {
  requirePermission(ctx, "ontology.admin");
  const existing = input.externalKey
    ? await db.ontologyObjects.find(
        ctx.tenantId,
        (o) => o.objectType === input.objectType && o.externalKey === input.externalKey,
      )
    : undefined;

  if (existing) {
    const effTitle = input.title ?? existing.title;
    const effStatus = input.status ?? existing.status;
    const effProperties = applyLedgers(
      { ...existing.properties, ...(input.properties ?? {}) },
      existing.properties,
      input.appendLedger,
    );
    // Canonical-schema check on the effective (post-merge) object. Warns or
    // rejects per the tenant's enforcement mode (default warn).
    await checkCanonicalSchema(ctx, {
      objectType: input.objectType,
      externalKey: input.externalKey ?? existing.externalKey,
      title: effTitle,
      status: effStatus,
      properties: effProperties,
    });
    const merged = await db.ontologyObjects.update(existing.id, {
      title: effTitle,
      status: effStatus,
      properties: effProperties,
      updatedAt: now(),
    });
    await recordHistory(ctx, merged, "update");
    return merged;
  }

  const ts = now();
  const createdProperties = applyLedgers(input.properties ?? {}, {}, input.appendLedger);
  // Canonical-schema check on the object about to be created. Warns or rejects
  // per the tenant's enforcement mode (default warn).
  await checkCanonicalSchema(ctx, {
    objectType: input.objectType,
    externalKey: input.externalKey ?? null,
    title: input.title ?? null,
    status: input.status ?? null,
    properties: createdProperties,
  });
  const created = await db.ontologyObjects.insert({
    id: id("obj"),
    tenantId: ctx.tenantId,
    objectType: input.objectType,
    externalKey: input.externalKey ?? null,
    title: input.title ?? null,
    status: input.status ?? null,
    properties: createdProperties,
    createdAt: ts,
    updatedAt: ts,
  });
  await recordHistory(ctx, created, "create");
  return created;
}

/**
 * Canonical-object schema check (ONT-001 §C, ADR-0006). Runs before persistence
 * on the effective object:
 *
 *  - Unregistered objectType → no-op (unaffected).
 *  - No violations → no-op.
 *  - WARN mode (default): emit an `ontology.schema.warning` audit event and
 *    proceed. Fail-open — the emit is best-effort and SHALL NOT turn a successful
 *    write into a failure (Constitution Article IV).
 *  - ENFORCE mode (explicitly enabled per tenant/global/env): emit an
 *    `ontology.schema.rejected` audit event (best-effort) and THROW
 *    OntologySchemaError, so the caller's write never persists. Fail-closed.
 *
 * Validation and mode resolution are total (never throw), so the only error this
 * can raise is the deliberate OntologySchemaError in enforce mode.
 */
async function checkCanonicalSchema(ctx: ActorContext, effective: CanonicalObjectInput): Promise<void> {
  const schema = schemaFor(effective.objectType);
  if (!schema) return;
  const violations = validateCanonicalObject(schema, effective);
  if (violations.length === 0) return;

  const mode = resolveEnforcementMode(ctx.tenantId);
  if (mode === "enforce") {
    await safeEmitSchemaEvent(ctx, "ontology.schema.rejected", effective, violations);
    throw new OntologySchemaError(effective.objectType, effective.externalKey ?? null, violations);
  }
  await safeEmitSchemaEvent(ctx, "ontology.schema.warning", effective, violations);
}

/** Best-effort schema audit emit. Never throws, never alters the write outcome. */
async function safeEmitSchemaEvent(
  ctx: ActorContext,
  action: "ontology.schema.warning" | "ontology.schema.rejected",
  effective: CanonicalObjectInput,
  violations: Violation[],
): Promise<void> {
  try {
    await emitAudit(
      ctx,
      action,
      { type: effective.objectType, id: effective.externalKey ?? null },
      {
        objectType: effective.objectType,
        externalKey: effective.externalKey ?? null,
        violations,
      },
    );
  } catch {
    // Auditing the check SHALL NOT block or fail the operation.
  }
}

export async function linkObjects(
  ctx: ActorContext,
  input: {
    linkType: string;
    from: { objectType: string; objectId: string };
    to: { objectType: string; objectId: string };
    properties?: Record<string, unknown>;
  },
): Promise<OntologyLink> {
  requirePermission(ctx, "ontology.admin");
  const existing = await db.ontologyLinks.find(
    ctx.tenantId,
    (l) =>
      l.linkType === input.linkType &&
      l.fromObjectId === input.from.objectId &&
      l.toObjectId === input.to.objectId,
  );
  if (existing) return existing;

  // Warn-only canonical relationship check (ONT-002). Never blocks the write.
  await warnOnRelationshipViolations(ctx, input);

  return await db.ontologyLinks.insert({
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

/**
 * Warn-only canonical relationship validation (ONT-002 §Validation). Emits an
 * `ontology.relationship.warning` audit event when a new edge is unknown, has an
 * illegal source/target/direction, or violates a practical cardinality bound —
 * but NEVER blocks the write. Fail-open: any error here is swallowed
 * (Constitution Article IV). Cardinality degree counts exclude the exact edge
 * being created (it was already shown not to exist by the caller).
 */
async function warnOnRelationshipViolations(
  ctx: ActorContext,
  input: { linkType: string; from: { objectType: string; objectId: string }; to: { objectType: string; objectId: string } },
): Promise<void> {
  try {
    const all = await db.ontologyLinks.list(ctx.tenantId, (l) => l.linkType === input.linkType);
    const sourceOutDegree = all.filter((l) => l.fromObjectId === input.from.objectId).length;
    const targetInDegree = all.filter((l) => l.toObjectId === input.to.objectId).length;
    const violations = validateRelationship(
      { linkType: input.linkType, sourceType: input.from.objectType, targetType: input.to.objectType },
      { sourceOutDegree, targetInDegree },
    );
    if (violations.length === 0) return;
    await emitAudit(
      ctx,
      "ontology.relationship.warning",
      { type: input.linkType, id: `${input.from.objectId}->${input.to.objectId}` },
      {
        linkType: input.linkType,
        sourceType: input.from.objectType,
        targetType: input.to.objectType,
        violations,
      },
    );
  } catch {
    // Warn-only: relationship validation SHALL NOT block or fail a write.
  }
}

export async function listObjects(ctx: ActorContext, objectType?: string): Promise<OntologyObject[]> {
  return await db.ontologyObjects.list(ctx.tenantId, objectType ? (o) => o.objectType === objectType : undefined);
}

export async function linksFor(ctx: ActorContext, objectId: string): Promise<OntologyLink[]> {
  return await db.ontologyLinks.list(
    ctx.tenantId,
    (l) => l.fromObjectId === objectId || l.toObjectId === objectId,
  );
}

async function recordHistory(ctx: ActorContext, obj: OntologyObject, kind: "create" | "update"): Promise<void> {
  await emitAudit(ctx, `ontology.object.${kind}`, { type: obj.objectType, id: obj.id }, {
    objectType: obj.objectType,
    externalKey: obj.externalKey,
  });
}
