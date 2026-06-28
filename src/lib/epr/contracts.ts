/* ============================================================================
   EPR-001 — Enterprise Property Runtime · Contracts
   ----------------------------------------------------------------------------
   ONE runtime, ANY Enterprise Object. A Studio is a PROJECTION of an
   ObjectSchema over this runtime — no Studio re-implements property logic,
   maturity, readiness, evidence, or advisory ranking.

   Ported and TYPED from the canonical `epr-runtime.js` reference shipped in the
   LAWRENCE bundle. Pure + deterministic: identical inputs -> identical outputs,
   no Date / random / IO, so a list of mutations replays to identical state.
   ========================================================================== */

/** Where a property value came from. Drives the provenance chip + color. */
export type Provenance =
  | "suggestion"
  | "typed"
  | "ai"
  | "inference"
  | "paste"
  | "upload"
  | "import"
  | "template"
  | "market"
  | "set";

/** A field renders as a single-select, a multi-select, or free text. */
export type FieldKind = "single" | "multi" | "text";

/** The committed state of one property of an Enterprise Object. */
export interface PropertyState {
  value: string | string[];
  src: Provenance;
  /** Confidence 0..1. */
  conf: number;
  /** Append-only evidence labels backing this value. */
  evidence: string[];
}

/** A single field in the schema. */
export interface FieldDef {
  key: string;
  label: string;
  /** Short label used in the "missing required" summary. */
  short?: string;
  kind: FieldKind;
  req?: boolean;
  /** For multi fields: minimum entries to count as "filled". */
  min?: number;
  /** Suggested chips. */
  chips?: string[];
  /** Progressive disclosure: selecting value X reveals related chips. */
  related?: Record<string, string[]>;
  /** Field supports a "Normalize" rail action. */
  norm?: boolean;
}

export interface SchemaSection {
  id: string;
  name: string;
  hint?: string;
  fields: FieldDef[];
}

/** An advisor recommendation rule — data, not code. */
export interface RecDef {
  label: string;
  /** Maturity/readiness gain if applied. Drives ranking. */
  gain: number;
  kind: "market" | "normalize" | "dedupe" | "fill" | string;
  key: string;
}

/** A complete Enterprise Object definition the runtime projects. */
export interface ObjectSchema {
  objectType: string;
  label: string;
  /** Glyph/short code for the object header. */
  glyph?: string;
  /** Display name of the studio that projects this object (e.g. "Job Studio"). */
  studio?: string;
  /** Keys that together establish identity (maturity step "Identified"). */
  identityKeys: string[];
  /** Key whose presence marks the object "Governed". */
  governKey?: string;
  sections: SchemaSection[];
  recs?: RecDef[];
}

/** Optional market-intelligence overlay (maturity step "Market-Aware"). */
export interface MarketState {
  on: boolean;
  label?: string;
}

/** One entry in the human-readable activity / evolution feed. */
export interface Activity {
  text: string;
  src: Provenance;
  color: string;
}

/** The full runtime state for one object instance. */
export interface EprState {
  props: Record<string, PropertyState>;
  /** Uncommitted draft text per field. */
  draft: Record<string, string>;
  evolveCount: number;
  activity: Activity[];
  published: boolean;
}

/** A projected, render-ready view of one field (no DOM handlers — React owns events). */
export interface ProjectedField {
  key: string;
  label: string;
  req: boolean;
  kind: FieldKind;
  hasValue: boolean;
  value: string | string[];
  srcLabel: string;
  srcColor: string;
  srcBg: string;
  srcBorder: string;
  confText: string;
  evidence: string[];
  evN: number;
  /** Chips with selected state, ready to render. */
  chips: { label: string; selected: boolean }[];
  selected: string[];
  norm: boolean;
}

export interface ProjectedSection {
  id: string;
  name: string;
  hint?: string;
  fields: ProjectedField[];
  doneLabel: string;
  doneColor: string;
}

export interface AdvisorItem {
  label: string;
  gain: number;
  kind: string;
  key: string;
}
