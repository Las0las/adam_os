// LayoutEngine — composes resolved sections from a projection's layout definition
// and the object's fields. When a projection declares no layout (e.g. grid/graph
// surfaces, or a terse create form), it synthesizes a single default section from
// the object's editable fields. Layout decisions live here, not in components.

import type { EnterpriseObjectDefinition } from "../contracts/enterprise-object";
import type { ProjectionDefinition, ProjectionMode } from "../contracts/projection-definition";
import type { ResolvedField, ResolvedSection } from "../contracts/universal-projection";

/**
 * Build resolved sections by placing already-resolved fields (keyed by field key)
 * into the projection's layout. Unknown field keys in the layout are skipped
 * (fail-soft). When the projection has no layout, all visible fields fall into
 * one default section.
 */
export function composeSections(
  object: EnterpriseObjectDefinition,
  projection: ProjectionDefinition,
  resolvedByKey: Map<string, ResolvedField>,
  _mode: ProjectionMode,
): ResolvedSection[] {
  if (projection.layout && projection.layout.length > 0) {
    return projection.layout.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      columns: section.columns ?? 1,
      fields: section.fields
        .map((key) => resolvedByKey.get(key))
        .filter((f): f is ResolvedField => Boolean(f) && (f as ResolvedField).visible),
    }));
  }

  // No declared layout: one default section of all visible fields in object order.
  const fields = object.fields
    .map((f) => resolvedByKey.get(f.key))
    .filter((f): f is ResolvedField => Boolean(f) && (f as ResolvedField).visible);

  return [{ id: "default", columns: 1, fields }];
}
