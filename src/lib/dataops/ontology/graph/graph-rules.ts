// Graph rules registry (VS-005 / ADR-0009). The ONLY place enterprise graph
// business constraints live — the validators in graph-integrity.ts are generic
// and hardcode none of this. Rules are fully configurable; validateGraph accepts
// an override set, and these are the platform defaults (the canonical recruiting
// pipeline + policy examples from the VS-005 specification).
//
// Many rules reference object types not yet implemented (Resume, Interview,
// Offer, Placement, Mission, Client, Task, Artifact). That is intentional and
// future-safe: a rule for/under a type only produces findings when objects of
// that type exist. The engine is on-demand (not wired into writes), so declaring
// these rules changes no existing behavior.

import type { GraphRule, GraphGlobalConfig } from "./graph-types";

export const DEFAULT_GRAPH_CONFIG: GraphGlobalConfig = {
  // Self/loop references are permitted only for these linkTypes (e.g. a Policy
  // may reference another Policy). All other linkTypes are acyclic.
  cycleAllowedLinkTypes: ["references"],
};

export const DEFAULT_GRAPH_RULES: readonly GraphRule[] = [
  {
    objectType: "Candidate",
    mustConnect: true, // a fully isolated candidate is an orphan
    requiredRelationships: [
      { linkType: "has_resume", direction: "out", otherType: "Resume", min: 1, description: "Candidate must have a Resume" },
    ],
    cardinality: [
      { linkType: "has_primary_resume", direction: "out", max: 1, description: "At most one primary resume" },
    ],
    uniqueRelationships: ["has_primary_resume"],
  },
  {
    objectType: "Resume",
    mustConnect: true,
  },
  {
    objectType: "Submission",
    requiredRelationships: [
      { linkType: "targets", direction: "out", otherType: "Job", min: 1, description: "Submission must reference a Job" },
    ],
    cardinality: [
      { linkType: "targets", direction: "out", otherType: "Job", min: 1, max: 1, description: "A submission targets exactly one job" },
    ],
    policies: [
      {
        id: "submission_requires_candidate",
        description: "A submission must originate from a candidate",
        related: { linkType: "submitted", direction: "in", otherType: "Candidate" },
      },
    ],
  },
  {
    objectType: "Job",
    cardinality: [
      { linkType: "targets", direction: "in", otherType: "Submission", min: 1, description: "A job has at least one submission (1..*)" },
    ],
  },
  {
    objectType: "Interview",
    requiredRelationships: [
      { linkType: "has_interview", direction: "in", otherType: "Submission", min: 1, description: "Interview must reference a Submission" },
    ],
    policies: [
      {
        id: "interview_requires_submission",
        description: "An interview cannot exist unless its submission exists",
        related: { linkType: "has_interview", direction: "in", otherType: "Submission" },
      },
    ],
  },
  {
    objectType: "Offer",
    requiredRelationships: [
      { linkType: "resulted_in_offer", direction: "in", otherType: "Interview", min: 1, description: "Offer must reference an Interview" },
    ],
    forbiddenParentTypes: ["Candidate"], // no direct Candidate -> Offer shortcut
    policies: [
      {
        id: "offer_requires_approved_interview",
        description: "An offer requires an approved interview",
        related: { linkType: "resulted_in_offer", direction: "in", otherType: "Interview", withStatus: "approved" },
      },
    ],
  },
  {
    objectType: "Placement",
    requiredRelationships: [
      { linkType: "resulted_in_placement", direction: "in", otherType: "Offer", min: 1, description: "Placement must reference an Offer" },
    ],
    forbiddenParentTypes: ["Candidate", "Submission", "Interview"], // canonical path only
    policies: [
      {
        id: "placement_requires_accepted_offer",
        description: "A placement requires an accepted offer",
        related: { linkType: "resulted_in_placement", direction: "in", otherType: "Offer", withStatus: "accepted" },
      },
    ],
  },
  {
    objectType: "Artifact",
    mustConnect: true,
    requiredRelationships: [
      { linkType: "owned_by", direction: "out", min: 1, description: "An artifact must have an owner" },
    ],
  },
  {
    objectType: "Mission",
    reachability: {
      mustReachTypes: ["Candidate", "Job", "Client", "Task", "Artifact"],
      description: "A mission must reach its operating entities (no disconnected island)",
    },
  },
];

const BY_TYPE = new Map<string, GraphRule>(DEFAULT_GRAPH_RULES.map((r) => [r.objectType, r]));

export function defaultRuleFor(objectType: string): GraphRule | undefined {
  return BY_TYPE.get(objectType);
}

export function allDefaultGraphRules(): readonly GraphRule[] {
  return DEFAULT_GRAPH_RULES;
}

/** Build a fast lookup from an arbitrary rule set (for validateGraph overrides). */
export function indexRules(rules: readonly GraphRule[]): Map<string, GraphRule> {
  return new Map(rules.map((r) => [r.objectType, r]));
}
