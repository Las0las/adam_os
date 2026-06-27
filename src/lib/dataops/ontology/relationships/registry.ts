// Canonical Relationship Registry (ONT-002). Strongly-typed lookups over the seed
// RelationshipDefinitions. Analogous to the object schema registry: relationships
// without a registered definition are "unknown" and surface a warning (warn-only).

import type { RelationshipDefinition } from "./types";
import { RELATIONSHIP_DEFINITIONS } from "./definitions";

const BY_ID = new Map<string, RelationshipDefinition>(
  RELATIONSHIP_DEFINITIONS.map((d) => [d.id, d]),
);

const BY_LINK_TYPE = new Map<string, RelationshipDefinition[]>();
for (const d of RELATIONSHIP_DEFINITIONS) {
  const list = BY_LINK_TYPE.get(d.linkType) ?? [];
  list.push(d);
  BY_LINK_TYPE.set(d.linkType, list);
}

/** All registered relationship definitions. */
export function allRelationships(): readonly RelationshipDefinition[] {
  return RELATIONSHIP_DEFINITIONS;
}

/** Lookup by canonical id. */
export function relationshipById(id: string): RelationshipDefinition | undefined {
  return BY_ID.get(id);
}

/** All definitions that use a given wire linkType (a linkType may be polymorphic,
 *  e.g. `about` / `for` connect several type pairs). */
export function relationshipsByLinkType(linkType: string): readonly RelationshipDefinition[] {
  return BY_LINK_TYPE.get(linkType) ?? [];
}

/** The exact definition for a (linkType, sourceType, targetType) triple, if any. */
export function findRelationship(
  linkType: string,
  sourceType: string,
  targetType: string,
): RelationshipDefinition | undefined {
  return relationshipsByLinkType(linkType).find(
    (d) => d.sourceType === sourceType && d.targetType === targetType,
  );
}

export type { RelationshipDefinition } from "./types";
