// Pure relationship validation (ONT-002 §Validation). Total — never throws.
// Returns [] when the relationship is well-formed. Warn-only: callers surface
// these as warnings and SHALL NOT reject in VS-003.

import type {
  RelationshipInstanceInput,
  RelationshipDegrees,
  RelationshipDefinition,
  Violation,
} from "./types";
import { relationshipsByLinkType, findRelationship } from "./registry";

/** Structural validation: relationship type known, and source/target/direction
 *  legal for that type. */
export function validateRelationshipShape(input: RelationshipInstanceInput): Violation[] {
  const { linkType, sourceType, targetType } = input;
  const defs = relationshipsByLinkType(linkType);
  if (defs.length === 0) {
    return [
      {
        path: "linkType",
        code: "unknown_relationship_type",
        message: `Unknown relationship type "${linkType}" (no canonical definition)`,
      },
    ];
  }

  if (findRelationship(linkType, sourceType, targetType)) return []; // exact match

  // linkType is known but this (source, target) pair is not allowed — refine.
  const reversed = defs.some((d) => d.sourceType === targetType && d.targetType === sourceType);
  if (reversed) {
    return [
      {
        path: "direction",
        code: "invalid_direction",
        message: `Relationship "${linkType}" is defined as ${targetType} → ${sourceType}, not ${sourceType} → ${targetType}`,
      },
    ];
  }
  const sourceOk = defs.some((d) => d.sourceType === sourceType);
  const targetOk = defs.some((d) => d.targetType === targetType);
  if (sourceOk && !targetOk) {
    return [
      {
        path: "targetType",
        code: "invalid_target",
        message: `"${targetType}" is not a valid target for relationship "${linkType}" from "${sourceType}"`,
      },
    ];
  }
  if (!sourceOk && targetOk) {
    return [
      {
        path: "sourceType",
        code: "invalid_source",
        message: `"${sourceType}" is not a valid source for relationship "${linkType}" into "${targetType}"`,
      },
    ];
  }
  return [
    {
      path: "sourceType,targetType",
      code: "illegal_source_target",
      message: `(${sourceType} → ${targetType}) is not a legal pair for relationship "${linkType}"`,
    },
  ];
}

/** Practical cardinality checks for a matched definition, given existing-edge
 *  degree counts (the new edge is assumed not yet persisted). */
export function cardinalityViolations(
  def: RelationshipDefinition,
  degrees: RelationshipDegrees,
): Violation[] {
  const out: Violation[] = [];
  const { sourceOutDegree, targetInDegree } = degrees;
  switch (def.cardinality) {
    case "one_to_one":
      if (sourceOutDegree > 0)
        out.push({
          path: "cardinality",
          code: "cardinality",
          message: `${def.sourceType} already has a "${def.linkType}" target (one_to_one)`,
        });
      if (targetInDegree > 0)
        out.push({
          path: "cardinality",
          code: "cardinality",
          message: `${def.targetType} already has a "${def.linkType}" source (one_to_one)`,
        });
      break;
    case "one_to_many":
      if (targetInDegree > 0)
        out.push({
          path: "cardinality",
          code: "cardinality",
          message: `${def.targetType} already has a "${def.linkType}" source (one_to_many allows only one)`,
        });
      break;
    case "many_to_one":
      if (sourceOutDegree > 0)
        out.push({
          path: "cardinality",
          code: "cardinality",
          message: `${def.sourceType} already has a "${def.linkType}" target (many_to_one allows only one)`,
        });
      break;
    case "many_to_many":
      break;
  }
  return out;
}

/** Full validation: shape, plus cardinality when the relationship matches a
 *  definition and degree counts are supplied. Total; never throws. */
export function validateRelationship(
  input: RelationshipInstanceInput,
  degrees?: RelationshipDegrees,
): Violation[] {
  try {
    const shape = validateRelationshipShape(input);
    if (shape.length > 0) return shape;
    if (!degrees) return [];
    const def = findRelationship(input.linkType, input.sourceType, input.targetType);
    if (!def) return [];
    return cardinalityViolations(def, degrees);
  } catch (err) {
    return [
      {
        path: "",
        code: "validator_error",
        message: err instanceof Error ? err.message : String(err),
      },
    ];
  }
}
