// Canonical Relationship Model types (ONT-002 / AS-005). Relationships are
// first-class, versioned, governed contracts — not arbitrary graph edges. These
// types make the registry strongly typed: a RelationshipDefinition is a precise
// contract, never a loose record.

import type { Violation } from "../schemas/types";

/** Cardinality of a directed relationship `source --R--> target`.
 *  - one_to_one  : a source has ≤1 target of R; a target has ≤1 source of R.
 *  - one_to_many : a source has many targets of R; each target has ≤1 source.
 *  - many_to_one : many sources map to one target; each source has ≤1 target.
 *  - many_to_many: unconstrained on both sides. */
export type RelationshipCardinality = "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";

/** Governance lifecycle of the relationship contract itself (NOT instance state):
 *  - active     : in use today; endpoints are live object types.
 *  - planned    : declared, future-safe; endpoint object types may not exist yet.
 *  - deprecated : retained for compatibility; SHOULD NOT be used for new edges. */
export type RelationshipLifecycle = "active" | "planned" | "deprecated";

export interface RelationshipGovernance {
  /** Owning authority for this relationship contract. */
  owner: string;
  /** ONT-002 version that introduced it. */
  since: string;
  /** Contract stability signal. */
  stability: "stable" | "experimental";
}

/** Declared permission keys (declarative only in VS-003 — not yet enforced beyond
 *  the existing `ontology.admin` guard on linkObjects). */
export interface RelationshipPermissions {
  /** Permission a caller SHOULD hold to create this edge. */
  create?: string;
  /** Permission a caller SHOULD hold to remove this edge. */
  remove?: string;
}

/** Optional, declared validation hook. Pure; returns extra violations. Seed
 *  definitions do not use it — it is a declared extension point. */
export type RelationshipValidationHook = (input: RelationshipInstanceInput) => Violation[];

/** A single canonical relationship contract. */
export interface RelationshipDefinition {
  /** Stable, unique identifier (the relationship's canonical name). */
  id: string;
  /** The wire `linkType` persisted on OntologyLink for this relationship. */
  linkType: string;
  /** Canonical source object type (the `from` endpoint). */
  sourceType: string;
  /** Canonical target object type (the `to` endpoint). */
  targetType: string;
  /** Id of the inverse relationship definition, if one is registered, else null. */
  inverseRelationship: string | null;
  cardinality: RelationshipCardinality;
  description: string;
  lifecycle: RelationshipLifecycle;
  governance: RelationshipGovernance;
  /** Declared validation hooks (extension point; not used by seed defs). */
  validationHooks?: RelationshipValidationHook[];
  /** Declared events this relationship would emit (declarative only). */
  emittedEvents: string[];
  /** Declared permissions (declarative only). */
  permissions: RelationshipPermissions;
}

/** A concrete relationship instance being validated. */
export interface RelationshipInstanceInput {
  linkType: string;
  sourceType: string;
  targetType: string;
}

/** Existing-edge degree counts used for practical cardinality checks. */
export interface RelationshipDegrees {
  /** Existing edges of this linkType OUT of the same source object. */
  sourceOutDegree: number;
  /** Existing edges of this linkType IN to the same target object. */
  targetInDegree: number;
}

export type { Violation };
