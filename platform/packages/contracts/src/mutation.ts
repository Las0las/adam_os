/**
 * RFC-PC0 Contract 2 — Mutation Contract.
 *
 * The ONLY way object state changes. A Mutation is a request to change an object;
 * it is never applied directly. It is resolved by the Kernel into a Decision and,
 * if granted, an append-only DomainEvent. Mutations are reversible by contract.
 */
import type {
  ContentHash,
  EvidenceRef,
  EventId,
  Iso8601,
  MutationId,
  ObjectId,
  ObjectTypeId,
  PrincipalId,
  Sequence,
  TenantId,
} from "./common.js";
import type { Provenance } from "./enterprise-object.js";

/** A proposed change to a single property. */
export interface PropertyChange {
  readonly key: string;
  readonly value: unknown;
  readonly provenance: Provenance;
  readonly confidence: number;
  readonly evidence?: readonly EvidenceRef[];
}

/** A request to mutate an object. Carries everything the Kernel needs to govern it. */
export interface Mutation {
  readonly id: MutationId;
  readonly tenantId: TenantId;
  /** The acting principal. A mutation WITHOUT a principal must be denied (CCR-001). */
  readonly principalId: PrincipalId;
  readonly objectId: ObjectId;
  readonly objectTypeId: ObjectTypeId;
  readonly operation: "create" | "update" | "archive" | "restore";
  readonly changes: readonly PropertyChange[];
  /**
   * Idempotency key (content hash of the canonical mutation). Re-submitting the same
   * mutation must not produce a second event.
   */
  readonly idempotencyKey: ContentHash;
  /** Optional expected revision for optimistic concurrency. */
  readonly expectedRevision?: Sequence;
  readonly requestedAt: Iso8601;
}

/** The immutable fact emitted when a mutation is granted and applied. */
export interface DomainEvent {
  readonly id: EventId;
  readonly tenantId: TenantId;
  readonly sequence: Sequence;
  readonly objectId: ObjectId;
  readonly objectTypeId: ObjectTypeId;
  readonly type: string;
  readonly principalId: PrincipalId;
  readonly changes: readonly PropertyChange[];
  readonly causedByMutation: MutationId;
  /** Hash chain link to the previous event — tamper-evidence for the audit log. */
  readonly previousHash: ContentHash | null;
  readonly hash: ContentHash;
  readonly occurredAt: Iso8601;
}

/** The compensating instruction that makes a prior event reversible (Kernel guarantee). */
export interface ReversalPlan {
  readonly forEvent: EventId;
  readonly inverse: Mutation;
}
