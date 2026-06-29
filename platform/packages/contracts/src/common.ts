/**
 * Shared value objects used across every contract. These are nominal/branded
 * primitives so that, e.g., a TenantId can never be passed where a PrincipalId is
 * expected. Contracts define shape only — no runtime behavior lives here.
 */

declare const __brand: unique symbol;
/** Nominal branding helper. `Brand<string, "TenantId">` is incompatible with raw string. */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type PrincipalId = Brand<string, "PrincipalId">;
export type ObjectId = Brand<string, "ObjectId">;
export type ObjectTypeId = Brand<string, "ObjectTypeId">;
export type RuntimeId = Brand<string, "RuntimeId">;
export type CapabilityId = Brand<string, "CapabilityId">;
export type ProjectionId = Brand<string, "ProjectionId">;
export type DomainPackId = Brand<string, "DomainPackId">;
export type EventId = Brand<string, "EventId">;
export type DecisionId = Brand<string, "DecisionId">;
export type MutationId = Brand<string, "MutationId">;

/** ISO-8601 timestamp. */
export type Iso8601 = Brand<string, "Iso8601">;

/** Monotonic, replay-stable sequence number within a tenant's event log. */
export type Sequence = Brand<number, "Sequence">;

/** A SHA-256 content hash used for idempotency and audit chaining. */
export type ContentHash = Brand<string, "ContentHash">;

/** Who is acting. Every governed effect must be attributable to a Principal. */
export interface Principal {
  readonly id: PrincipalId;
  readonly tenantId: TenantId;
  readonly kind: "human" | "service" | "agent";
  readonly displayName: string;
  /** Roles/grants resolved elsewhere; carried here for authority evaluation. */
  readonly grants: readonly string[];
}

/** The tenancy boundary every read and write is scoped to. */
export interface TenantContext {
  readonly tenantId: TenantId;
}

/** Evidence link — a citation back to the fact(s) that justify a value or decision. */
export interface EvidenceRef {
  readonly objectId: ObjectId;
  readonly field?: string;
  readonly eventId?: EventId;
  readonly note?: string;
}

/** Standard, serializable result envelope. Contracts return data, never throw control flow. */
export type Result<T, E = ContractError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface ContractError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
