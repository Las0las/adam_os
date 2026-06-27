// Enterprise Graph Integrity Engine — types (VS-005 / ADR-0009). Validates the
// whole ontology graph (topology, connectivity, cardinality, cycles, paths,
// reachability, policy) deterministically. No AI, no heuristics. Rule-driven:
// validators are generic; all business constraints live in the rules registry.

import type { OntologyObject, OntologyLink } from "@/types/dataops";

/** Typed integrity violation codes. */
export type GraphCode =
  | "GRAPH_ORPHAN"
  | "GRAPH_CYCLE"
  | "GRAPH_DUPLICATE_EDGE"
  | "GRAPH_INVALID_PATH"
  | "GRAPH_REQUIRED_RELATIONSHIP"
  | "GRAPH_CARDINALITY"
  | "GRAPH_POLICY"
  | "GRAPH_UNREACHABLE"
  | "GRAPH_CONSTRAINT";

export type GraphSeverity = "error" | "warning";

/** A single deterministic integrity finding. */
export interface GraphFinding {
  code: GraphCode;
  severity: GraphSeverity;
  message: string;
  objectId?: string;
  objectType?: string;
  linkType?: string;
  /** Object-id path for cycles / invalid-path findings. */
  path?: string[];
}

/** Direction of an edge relative to the object a rule is evaluated for. */
export type EdgeDirection = "out" | "in";

/** A required relationship the object SHALL have (min occurrences). */
export interface RequiredRelationshipRule {
  linkType: string;
  direction: EdgeDirection;
  /** Optional type constraint on the far endpoint. */
  otherType?: string;
  /** Minimum occurrences (default 1). */
  min?: number;
  severity?: GraphSeverity;
  description?: string;
}

/** A cardinality bound on edges of a linkType in a direction. */
export interface CardinalityRule {
  linkType: string;
  direction: EdgeDirection;
  min?: number;
  max?: number;
  /** Optional type constraint on the far endpoint. */
  otherType?: string;
  severity?: GraphSeverity;
  description?: string;
}

/** A policy precondition: an object of this type requires a related object. */
export interface PolicyRule {
  id: string;
  description: string;
  related: {
    linkType: string;
    direction: EdgeDirection;
    otherType?: string;
    /** Require the related object to carry this status (e.g. approved/accepted). */
    withStatus?: string;
  };
  severity?: GraphSeverity;
}

/** A reachability requirement: objects of this type SHALL reach the given types. */
export interface ReachabilityRule {
  mustReachTypes: string[];
  /** Restrict traversal to these linkTypes (undefined = traverse all). */
  viaLinkTypes?: string[];
  severity?: GraphSeverity;
  description?: string;
}

/** The integrity contract for one object type. */
export interface GraphRule {
  objectType: string;
  /** A degree-0 object of this type is an orphan (GRAPH_ORPHAN). */
  mustConnect?: boolean;
  requiredRelationships?: RequiredRelationshipRule[];
  cardinality?: CardinalityRule[];
  /** linkTypes that SHALL be unique per object (duplicate → GRAPH_DUPLICATE_EDGE). */
  uniqueRelationships?: string[];
  /** Incoming source types that are illegal (illegal shortcut → GRAPH_INVALID_PATH). */
  forbiddenParentTypes?: string[];
  /** Outgoing target types that are illegal (GRAPH_INVALID_PATH). */
  forbiddenTargetTypes?: string[];
  reachability?: ReachabilityRule;
  policies?: PolicyRule[];
}

/** Global graph policy not tied to a single object type. */
export interface GraphGlobalConfig {
  /** linkTypes for which cycles are permitted (e.g. "references"). All other
   *  linkTypes are treated as acyclic; a cycle in them is GRAPH_CYCLE. */
  cycleAllowedLinkTypes: string[];
}

/** A graph snapshot to validate. */
export interface OntologyGraph {
  objects: OntologyObject[];
  links: OntologyLink[];
}

export interface GraphStatistics {
  objects: number;
  edges: number;
  disconnectedSubgraphs: number;
  orphanCount: number;
  validationTimeMs: number;
}

/** Deterministic integrity report. */
export interface GraphIntegrityReport {
  valid: boolean;
  errors: GraphFinding[];
  warnings: GraphFinding[];
  orphanObjects: string[];
  duplicateEdges: string[];
  invalidPaths: GraphFinding[];
  cycles: string[][];
  statistics: GraphStatistics;
}

export type { OntologyObject, OntologyLink };
