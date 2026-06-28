/**
 * INTERNAL — kernel-private. The append-only, hash-chained domain event log that
 * backs the kernel's commit + replay + reversibility guarantees. Per tenant it
 * maintains a monotonic sequence and a tamper-evident hash chain. It dedupes by
 * idempotency key, folds current object state, and captures a pre-image of each
 * change so a compensating reversal can be produced. No package outside
 * @lawrence/kernel may import this module; reads go through the governed kernel.
 */
import type {
  ContentHash,
  DomainEvent,
  Iso8601,
  Mutation,
  ObjectId,
  PropertyChange,
  Sequence,
  TenantId,
} from "@lawrence/contracts";

import { hashOf, mintEventId } from "./hashing.js";

/** Folded state of a single object: its current property values + archived flag. */
export interface ObjectState {
  readonly values: Readonly<Record<string, unknown>>;
  readonly archived: boolean;
  readonly exists: boolean;
}

function eventTypeFor(op: Mutation["operation"]): string {
  return `object.${op === "create" ? "created" : op === "update" ? "updated" : op === "archive" ? "archived" : "restored"}`;
}

export interface AppendResult {
  readonly event: DomainEvent;
  /** True when the mutation's idempotency key was already applied (no new event). */
  readonly deduped: boolean;
}

export class EventLog {
  private readonly events: DomainEvent[] = [];
  private readonly seqByTenant = new Map<TenantId, number>();
  private readonly headHashByTenant = new Map<TenantId, ContentHash>();
  private readonly byIdempotencyKey = new Map<string, DomainEvent>();
  private readonly preImage = new Map<string, Readonly<Record<string, unknown>>>();

  /** Append the event implied by a granted mutation, or return the existing one. */
  append(mutation: Mutation, occurredAt: Iso8601): AppendResult {
    const idemKey = `${mutation.tenantId}:${mutation.idempotencyKey}`;
    const existing = this.byIdempotencyKey.get(idemKey);
    if (existing) return { event: existing, deduped: true };

    const sequence = (this.seqByTenant.get(mutation.tenantId) ?? 0) + 1;
    const previousHash = this.headHashByTenant.get(mutation.tenantId) ?? null;

    // Capture the pre-image (current values of the keys this mutation changes)
    // BEFORE folding, so a reversal can restore them.
    const before = this.objectState(mutation.tenantId, mutation.objectId);
    const pre: Record<string, unknown> = {};
    for (const change of mutation.changes) pre[change.key] = before.values[change.key];

    const core = {
      tenantId: mutation.tenantId,
      sequence,
      objectId: mutation.objectId,
      objectTypeId: mutation.objectTypeId,
      type: eventTypeFor(mutation.operation),
      principalId: mutation.principalId,
      changes: mutation.changes,
      causedByMutation: mutation.id,
      previousHash,
      occurredAt,
    };
    const hash = hashOf(core);
    const event: DomainEvent = Object.freeze({
      id: mintEventId(hash),
      ...core,
      sequence: sequence as Sequence,
      hash,
    });

    this.events.push(event);
    this.seqByTenant.set(mutation.tenantId, sequence);
    this.headHashByTenant.set(mutation.tenantId, hash);
    this.byIdempotencyKey.set(idemKey, event);
    this.preImage.set(event.id, Object.freeze(pre));

    return { event, deduped: false };
  }

  /** Live folded state for one object (tenant-scoped). */
  objectState(tenantId: TenantId, objectId: ObjectId): ObjectState {
    return foldState(this.eventsFor(tenantId).filter((e) => e.objectId === objectId));
  }

  /** Pre-image captured at append time, used to build a reversal. */
  preImageFor(eventId: string): Readonly<Record<string, unknown>> | null {
    return this.preImage.get(eventId) ?? null;
  }

  /** Current revision (highest applied sequence) of one object; 0 if it has none. */
  objectRevision(tenantId: TenantId, objectId: ObjectId): number {
    let max = 0;
    for (const e of this.events) {
      if (e.tenantId === tenantId && e.objectId === objectId && e.sequence > max) {
        max = e.sequence;
      }
    }
    return max;
  }

  /** Tenant-scoped event list (CCR-003: never returns another tenant's events). */
  eventsFor(tenantId: TenantId): readonly DomainEvent[] {
    return this.events.filter((e) => e.tenantId === tenantId);
  }

  count(): number {
    return this.events.length;
  }
}

/**
 * Pure fold: rebuild an object's state from an ordered event slice. Deterministic
 * and side-effect-free — this is what makes CCR-002 (replay equivalence) provable.
 */
export function foldState(events: readonly DomainEvent[]): ObjectState {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const values: Record<string, unknown> = {};
  let archived = false;
  let exists = false;
  for (const e of ordered) {
    if (e.type === "object.archived") archived = true;
    else if (e.type === "object.restored") archived = false;
    else {
      exists = true;
      for (const c of e.changes) values[c.key] = c.value;
    }
  }
  return Object.freeze({ values: Object.freeze({ ...values }), archived, exists });
}

/** Build the inverse property changes that restore a pre-image. */
export function inverseChanges(
  changes: readonly PropertyChange[],
  preImage: Readonly<Record<string, unknown>>,
): PropertyChange[] {
  return changes.map((c) => ({
    key: c.key,
    value: preImage[c.key],
    provenance: "inferred" as const,
    confidence: 1,
  }));
}
