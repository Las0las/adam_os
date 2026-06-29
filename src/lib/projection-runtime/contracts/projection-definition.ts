// Universal Projection Runtime — ProjectionDefinition contracts.
//
// A ProjectionDefinition describes HOW an enterprise object is surfaced. It
// references an EnterpriseObjectDefinition by objectType and selects a surface
// (modal/drawer/fullPage/grid/calendar/document/graph/command), a mode, a layout,
// and which intents to expose. Many projections can target the same object —
// that is the whole point: surface independence with one domain definition.

/** The eight first-class projection surfaces. */
export type SurfaceKind =
  | "modal"
  | "drawer"
  | "fullPage"
  | "grid"
  | "calendar"
  | "document"
  | "graph"
  | "command";

/** Whether the projection creates, edits, views, or lists instances. */
export type ProjectionMode = "create" | "edit" | "view" | "list";

/** A layout section grouping a subset of fields (for form-like surfaces). */
export interface LayoutSectionDefinition {
  id: string;
  title?: string;
  description?: string;
  /** Field keys (must exist on the referenced object definition). */
  fields: string[];
  columns?: 1 | 2;
}

/** Display bindings for non-form surfaces (grid columns, calendar date field,
 *  graph node label). Kept declarative so the same object renders into any of
 *  them without bespoke code. */
export interface ProjectionDisplay {
  /** Grid columns. */
  columns?: { field: string; label?: string }[];
  /** Calendar item date field key. */
  dateField?: string;
  /** Calendar item title field key. */
  titleField?: string;
  /** Graph node label field key. */
  nodeLabelField?: string;
  /** Document block ordering of field keys. */
  blocks?: string[];
}

/** The presentation contract for one surface of one object. */
export interface ProjectionDefinition {
  /** Stable id, e.g. "Candidate.Create.Modal". */
  id: string;
  /** References EnterpriseObjectDefinition.objectType. */
  objectType: string;
  surface: SurfaceKind;
  mode: ProjectionMode;
  title: string;
  description?: string;
  /** Field sections for form surfaces. */
  layout?: LayoutSectionDefinition[];
  /** Primary submit intent (by name). */
  primaryIntent?: string;
  /** Additional intents to surface as secondary actions. */
  secondaryIntents?: string[];
  /** Display bindings for grid/calendar/document/graph surfaces. */
  display?: ProjectionDisplay;
}
