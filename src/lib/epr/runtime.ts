/* ============================================================================
   EPR-001 — Enterprise Property Runtime · Pure Engine
   ----------------------------------------------------------------------------
   Typed port of the canonical `epr-runtime.js`. Every function is pure and
   deterministic. Both Job Intake Studio and Candidate Studio call ONLY these
   functions — neither re-implements maturity, readiness, evidence or advisory.
   ========================================================================== */

import type {
  AdvisorItem,
  EprState,
  FieldDef,
  MarketState,
  ObjectSchema,
  ProjectedField,
  ProjectedSection,
  Provenance,
  PropertyState,
} from "./contracts";

/** The canonical maturity ladder — identical for every Enterprise Object. */
export const MATURITY = [
  "Draft",
  "Identified",
  "Enriched",
  "Validated",
  "Governed",
  "Market-Aware",
  "Production Ready",
  "Operational",
  "Observed",
  "Continuously Evolving",
] as const;

export const MAT_COLORS = [
  "#5c6b7a", "#0c6fb0", "#1e8a8b", "#00875f", "#9a6b00",
  "#0c6fb0", "#00875f", "#00875f", "#00875f", "#00875f",
] as const;

/** Provenance -> [label, text/border color, bg, border]. LDS color triples. */
export function srcMeta(src: Provenance): [string, string, string, string] {
  const table: Record<string, [string, string, string, string]> = {
    suggestion: ["suggestion", "#0c6fb0", "#e6f4fb", "#bfe3f5"],
    typed: ["typed", "#5c6b7a", "#eef2f7", "#d9e1ea"],
    ai: ["AI", "#0a5c5d", "#e6f6f6", "#bde6e6"],
    inference: ["inferred", "#9a6b00", "#fbf3d2", "#ecdca0"],
    paste: ["pasted", "#9a6b00", "#fbf3d2", "#ecdca0"],
    upload: ["uploaded", "#9a6b00", "#fbf3d2", "#ecdca0"],
    import: ["imported", "#00875f", "#e2f5ee", "#b7e6d5"],
    template: ["template", "#00875f", "#e2f5ee", "#b7e6d5"],
    market: ["market", "#0c6fb0", "#e6f4fb", "#bfe3f5"],
  };
  return table[src] || ["set", "#5c6b7a", "#eef2f7", "#d9e1ea"];
}

const ENRICH_SOURCES: Provenance[] = ["ai", "inference", "import", "template"];

export function fieldOf(schema: ObjectSchema, key: string): FieldDef | null {
  for (const s of schema.sections) {
    for (const f of s.fields) if (f.key === key) return f;
  }
  return null;
}

export function reqKeys(schema: ObjectSchema): string[] {
  const a: string[] = [];
  schema.sections.forEach((s) => s.fields.forEach((f) => { if (f.req) a.push(f.key); }));
  return a;
}

export function filled(props: Record<string, PropertyState>, key: string, schema: ObjectSchema): boolean {
  const f = fieldOf(schema, key);
  const p = props[key];
  if (!p) return false;
  const v = p.value;
  if (Array.isArray(v)) return v.length >= (f && f.min ? f.min : 1);
  return v != null && String(v).trim() !== "";
}

export function evidenceTotal(props: Record<string, PropertyState>): number {
  return Object.values(props).reduce((a, x) => a + ((x.evidence && x.evidence.length) || 0), 0);
}

/** Readiness 0..100: required coverage (78%) + enrichment (10) + market (12). */
export function readiness(props: Record<string, PropertyState>, market: MarketState | null, schema: ObjectSchema): number {
  const req = reqKeys(schema);
  const n = req.filter((k) => filled(props, k, schema)).length;
  let r = Math.round((n / Math.max(1, req.length)) * 78);
  if (Object.values(props).some((p) => ENRICH_SOURCES.indexOf(p.src) >= 0)) r += 10;
  if (market && market.on) r += 12;
  return Math.min(100, r);
}

/** Canonical maturity index into MATURITY — identical computation for every object. */
export function maturityIndex(
  props: Record<string, PropertyState>,
  market: MarketState | null,
  published: boolean,
  schema: ObjectSchema,
): number {
  const has = (k: string) => filled(props, k, schema);
  const anyEnrich = Object.values(props).some((x) => ENRICH_SOURCES.indexOf(x.src) >= 0);
  const evCount = evidenceTotal(props);
  const idKeys = (schema.identityKeys || []).every(has);
  const allReq = reqKeys(schema).every(has);
  const conds = [
    true,                                            // 0 Draft
    idKeys,                                           // 1 Identified
    anyEnrich,                                        // 2 Enriched
    evCount >= 2,                                     // 3 Validated
    has(schema.governKey || "__none__"),              // 4 Governed
    !!(market && market.on),                          // 5 Market-Aware
    readiness(props, market, schema) >= 85 && allReq, // 6 Production Ready
    !!published, !!published, !!published,            // 7-9 Operational / Observed / Evolving
  ];
  let idx = 0;
  for (let i = 0; i < conds.length; i++) {
    if (conds[i]) idx = i;
    else if (i > 0) break;
  }
  return idx;
}

/** The Mutation Engine: one governed mutation -> new state + an evolution event. */
export function applyEvolution(
  state: EprState,
  key: string,
  value: string | string[],
  src: Provenance,
  conf: number,
  evLabel: string | null,
  schema: ObjectSchema,
): EprState {
  const props = { ...state.props };
  const prev = props[key] || { evidence: [] as string[] };
  const evidence = evLabel ? [...(prev.evidence || []), evLabel] : (prev.evidence || []);
  props[key] = { value, src, conf, evidence };
  const f = fieldOf(schema, key);
  const disp = Array.isArray(value) ? value.join(", ") : String(value);
  const act = {
    text: "Set " + (f ? f.label : key) + (disp && disp.length < 34 ? " — " + disp : ""),
    src,
    color: srcMeta(src)[1],
  };
  const draft = { ...state.draft };
  delete draft[key];
  return {
    ...state,
    props,
    draft,
    evolveCount: (state.evolveCount || 0) + 1,
    activity: [act, ...(state.activity || [])].slice(0, 30),
  };
}

/** Advisor Runtime: rank the next best evolutions by maturity gain (from schema.recs). */
export function advisorItems(
  props: Record<string, PropertyState>,
  market: MarketState | null,
  schema: ObjectSchema,
): AdvisorItem[] {
  const out: AdvisorItem[] = [];
  (schema.recs || []).forEach((r) => {
    let show = false;
    if (r.kind === "market") show = !(market && market.on);
    else show = !filled(props, r.key, schema);
    if (r.kind === "normalize") { const p = props[r.key]; show = !!p && p.src !== "ai"; }
    if (r.kind === "dedupe") show = filled(props, r.key, schema);
    if (show) out.push({ label: r.label, gain: r.gain, kind: r.kind, key: r.key });
  });
  out.sort((a, b) => b.gain - a.gain);
  return out;
}

export function missingReq(props: Record<string, PropertyState>, schema: ObjectSchema): { key: string; label: string }[] {
  const labels: Record<string, string> = {};
  schema.sections.forEach((s) => s.fields.forEach((f) => { labels[f.key] = f.short || f.label; }));
  return reqKeys(schema)
    .filter((k) => !filled(props, k, schema))
    .map((k) => ({ key: k, label: labels[k] || k }));
}

/** Progressive suggestions: a selected value can reveal related ones (PSI-6). */
export function chipsFor(f: FieldDef, props: Record<string, PropertyState>): string[] {
  const chips = (f.chips || []).slice();
  if (f.related) {
    const cur = props[f.key];
    const sel = (cur && Array.isArray(cur.value) ? cur.value : []) as string[];
    sel.forEach((v) => { (f.related![v] || []).forEach((r) => { if (chips.indexOf(r) < 0) chips.push(r); }); });
  }
  return chips;
}

/** The Property Projection: render-ready sections every PropertyCard maps over. */
export function buildSections(schema: ObjectSchema, state: EprState): ProjectedSection[] {
  const props = state.props;
  return schema.sections.map((sec) => {
    const fields: ProjectedField[] = sec.fields.map((f) => {
      const p = props[f.key];
      const has = filled(props, f.key, schema);
      const sm = p ? srcMeta(p.src) : null;
      const isMulti = f.kind === "multi";
      const curVal = p ? p.value : (isMulti ? [] : "");
      const selected = isMulti ? ((curVal as string[]) || []) : [];
      const chips = chipsFor(f, props).map((c) => ({
        label: c,
        selected: isMulti ? selected.indexOf(c) >= 0 : curVal === c,
      }));
      return {
        key: f.key,
        label: f.label,
        req: !!f.req,
        kind: f.kind,
        hasValue: has,
        value: curVal,
        srcLabel: sm ? sm[0] : "",
        srcColor: sm ? sm[1] : "",
        srcBg: sm ? sm[2] : "",
        srcBorder: sm ? sm[3] : "",
        confText: p ? Number(p.conf).toFixed(2) : "",
        evidence: p && p.evidence ? p.evidence : [],
        evN: p && p.evidence ? p.evidence.length : 0,
        chips,
        selected,
        norm: !!(f.norm && has),
      };
    });
    const allFilled = sec.fields.filter((f) => filled(props, f.key, schema)).length;
    return {
      id: sec.id,
      name: sec.name,
      hint: sec.hint,
      fields,
      doneLabel: allFilled + "/" + sec.fields.length,
      doneColor: allFilled === sec.fields.length ? "#00875f" : allFilled > 0 ? "#9a6b00" : "#93a1b0",
    };
  });
}

/** Fresh empty state for an object instance. */
export function emptyState(): EprState {
  return { props: {}, draft: {}, evolveCount: 0, activity: [], published: false };
}
