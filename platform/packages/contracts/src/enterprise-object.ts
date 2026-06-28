/**
 * RFC-PC0 Contract 1 — Enterprise Object Contract.
 *
 * The stable shape of every governed thing in the platform (a Job, a Candidate, an
 * Account...). The platform is "any object over one runtime": a domain never gets a
 * bespoke type — it registers an ObjectType and the runtime projects it.
 */
import type {
  ContentHash,
  EvidenceRef,
  Iso8601,
  ObjectId,
  ObjectTypeId,
  PrincipalId,
  Sequence,
  TenantId,
} from "./common.js";

/** Provenance: how a property's current value came to exist. */
export type Provenance =
  | "typed"
  | "selected"
  | "pasted"
  | "imported"
  | "ai"
  | "inferred"
  | "template"
  | "external";

/** A single governed property: a value plus the evidence and provenance behind it. */
export interface EnterpriseProperty<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly provenance: Provenance;
  /** Calibrated 0..1 confidence in the value (typed/human input is authoritative = 1). */
  readonly confidence: number;
  readonly evidence: readonly EvidenceRef[];
  readonly updatedAt: Iso8601;
  readonly updatedBy: PrincipalId;
}

/** Field metadata declared by an ObjectType (shape, not value). */
export interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: "text" | "number" | "boolean" | "date" | "single" | "multi" | "reference";
  readonly required: boolean;
  /** True if this field participates in identity resolution. */
  readonly identity?: boolean;
  /** For reference fields: the ObjectType this points at. */
  readonly references?: ObjectTypeId;
}

/** The registered definition of a kind of Enterprise Object. */
export interface ObjectTypeDefinition {
  readonly typeId: ObjectTypeId;
  readonly label: string;
  readonly version: string;
  readonly fields: readonly FieldDefinition[];
  /** Domain pack that owns this type (for provenance + capability scoping). */
  readonly ownerPack?: string;
}

/** A live Enterprise Object instance — an identity + its current governed properties. */
export interface EnterpriseObject {
  readonly id: ObjectId;
  readonly typeId: ObjectTypeId;
  readonly tenantId: TenantId;
  readonly properties: Readonly<Record<string, EnterpriseProperty>>;
  /** Append-only sequence of the last event folded into this snapshot. */
  readonly revision: Sequence;
  /** Content hash of the canonical property set — drives replay-equivalence checks. */
  readonly stateHash: ContentHash;
  readonly createdAt: Iso8601;
  readonly updatedAt: Iso8601;
}
