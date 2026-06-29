"use client";

/* ============================================================================
   LAWRENCE Universal Workspace Shell — the permanent host for EPR-001.

   The mockup's thesis, now made real: there is ONE workspace shell, and Studios
   (Job, Candidate, …) are NOT separate apps — they are Enterprise Object
   projections HOSTED inside this shell. The header, 60px nav rail, collections
   column, center projection canvas, and advisor/inspector rail persist; only
   the hosted object changes.

   Every property in the center canvas, the header maturity tag, the advisor
   recommendations, and the inspector are PROJECTIONS over the EPR-001 runtime
   (src/lib/epr). This shell re-implements no maturity / readiness / evidence /
   advisory logic — selecting the Job vs Candidate object in the collections
   column swaps the schema fed to the same runtime.
   ========================================================================== */

import { useMemo, useState } from "react";
import {
  MATURITY,
  MAT_COLORS,
  advisorItems,
  applyEvolution,
  buildSections,
  emptyState,
  maturityIndex,
  missingReq,
  readiness,
  type EprState,
  type MarketState,
  type ObjectSchema,
  type Provenance,
} from "@/lib/epr";
import { jobSchema } from "@/lib/epr/schemas/job.schema";
import { candidateSchema } from "@/lib/epr/schemas/candidate.schema";
import "./universal-workspace.css";

type NavKey = "search" | "objects" | "pinned" | "advisor" | "diag" | "activity";
type TabKey = "props" | "evidence" | "timeline" | "activity";

/** The Enterprise Objects this workspace currently hosts. */
const OBJECTS: { id: string; schema: ObjectSchema; ref: string; dot: string }[] = [
  { id: "job", schema: jobSchema, ref: "job:JR-118", dot: "#09375f" },
  { id: "cand", schema: candidateSchema, ref: "person:CA-204", dot: "#44b0b1" },
];

const RAIL: { key: NavKey; name: string; glyph: string }[] = [
  { key: "search", name: "Search", glyph: "⌕" },
  { key: "objects", name: "Objects", glyph: "◳" },
  { key: "pinned", name: "Pinned", glyph: "★" },
  { key: "advisor", name: "Advisor", glyph: "◆" },
  { key: "diag", name: "Diagnostics", glyph: "⚐" },
  { key: "activity", name: "Activity", glyph: "⟲" },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "props", label: "Properties" },
  { key: "evidence", label: "Evidence" },
  { key: "timeline", label: "Timeline" },
  { key: "activity", label: "Activity" },
];

const INSP_TITLE: Record<TabKey, string> = {
  props: "Inspector · Properties",
  evidence: "Inspector · Evidence",
  timeline: "Inspector · Timeline",
  activity: "Inspector · Activity",
};

export function UniversalWorkspaceShell() {
  const [search, setSearch] = useState("");
  const [nav, setNav] = useState<NavKey>("objects");
  const [tab, setTab] = useState<TabKey>("props");

  // The hosted object + per-object runtime state. Each Enterprise Object keeps
  // its own EprState and market overlay; switching `objId` re-projects the shell.
  const [objId, setObjId] = useState("job");
  const [states, setStates] = useState<Record<string, EprState>>(() => ({
    job: emptyState(),
    cand: emptyState(),
  }));
  const [markets, setMarkets] = useState<Record<string, MarketState>>(() => ({
    job: { on: false, label: "Lightcast" },
    cand: { on: false, label: "Lightcast" },
  }));

  const host = OBJECTS.find((o) => o.id === objId)!;
  const schema = host.schema;
  const state = states[objId];
  const market = markets[objId];

  // Everything below is a PROJECTION — recomputed by the runtime, never stored.
  const sections = useMemo(() => buildSections(schema, state), [schema, state]);
  const advisor = useMemo(() => advisorItems(state.props, market, schema), [state.props, market, schema]);
  const missing = useMemo(() => missingReq(state.props, schema), [state.props, schema]);
  const ready = readiness(state.props, market, schema);
  const matIdx = maturityIndex(state.props, market, state.published, schema);

  function mutate(key: string, value: string | string[], src: Provenance, conf: number, ev: string | null) {
    setStates((all) => ({ ...all, [objId]: applyEvolution(all[objId], key, value, src, conf, ev, schema) }));
  }
  function setSingle(key: string, val: string, src: Provenance) {
    mutate(key, val, src, src === "ai" ? 0.92 : 0.8, src === "ai" ? "AI suggestion accepted" : null);
  }
  function toggleMulti(key: string, val: string) {
    const cur = (state.props[key]?.value as string[]) || [];
    const next = cur.indexOf(val) >= 0 ? cur.filter((v) => v !== val) : [...cur, val];
    mutate(key, next, "suggestion", 0.8, null);
  }
  function aiFill(key: string, label: string) {
    const f = schema.sections.flatMap((s) => s.fields).find((x) => x.key === key);
    const v = f?.kind === "multi" ? (f.chips || []).slice(0, 2) : (f?.chips?.[0] || "Generated");
    mutate(key, v, "ai", 0.92, `AI proposed ${label}`);
  }
  function acceptAdvisor(a: { label: string; kind: string; key: string }) {
    if (a.kind === "market") { setMarkets((m) => ({ ...m, [objId]: { ...m[objId], on: true } })); return; }
    aiFill(a.key, a.label);
  }
  function togglePublish() {
    if (ready < 85) return;
    setStates((all) => ({ ...all, [objId]: { ...all[objId], published: !all[objId].published } }));
  }

  const matColor = MAT_COLORS[matIdx];
  const matName = MATURITY[matIdx];

  return (
    <div className="uws">
      {/* ===== GLOBAL HEADER ===== */}
      <div
        style={{
          flex: "none",
          height: 52,
          background: "var(--navy)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 16px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            aria-hidden
            style={{
              width: 0,
              height: 0,
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderBottom: "15px solid var(--teal)",
            }}
          />
          <span style={{ font: "700 15px/1 var(--sans)", letterSpacing: "-.01em" }}>LAWRENCE</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.10)",
            border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 9,
            padding: "8px 12px",
            width: 380,
            maxWidth: "34vw",
          }}
        >
          <span style={{ color: "#9fc0db", fontSize: 12 }} aria-hidden>
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Universal Search — objects, people, capabilities…"
            aria-label="Universal search"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              font: "400 12px/1 var(--sans)",
            }}
          />
          <span
            style={{
              font: "700 8px/1 var(--mono)",
              color: "#9fc0db",
              border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 4,
              padding: "3px 5px",
            }}
          >
            ⌘K
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginLeft: 6,
            font: "500 11px/1 var(--sans)",
            color: "#bcd4e8",
          }}
        >
          <span style={{ color: "#7fe0d6", font: "700 9px/1 var(--mono)" }}>{schema.glyph}</span> {schema.label}{" "}
          <span style={{ color: "#6f93b4" }}>/ {schema.studio || "Studio"}</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              font: "600 9px/1 var(--mono)",
              color: "#fff",
              background: matColor,
              border: "1px solid rgba(255,255,255,.25)",
              borderRadius: 6,
              padding: "6px 9px",
            }}
          >
            ◆ {matName} · {ready}%
          </span>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--teal)",
              color: "var(--navy)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 11px/1 var(--sans)",
            }}
          >
            AC
          </span>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* NAV RAIL */}
        <div
          style={{
            flex: "none",
            width: 60,
            background: "var(--navy-deep)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
            padding: "12px 0",
          }}
        >
          {RAIL.map((r) => {
            const on = nav === r.key;
            return (
              <button
                key={r.key}
                className="navi"
                title={r.name}
                aria-label={r.name}
                aria-pressed={on}
                onClick={() => setNav(r.key)}
                style={{
                  width: 38,
                  height: 38,
                  border: "none",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "600 15px/1 var(--sans)",
                  color: on ? "#fff" : "#9fc0db",
                  background: on ? "var(--navy-soft)" : "transparent",
                }}
              >
                {r.glyph}
              </button>
            );
          })}
        </div>

        {/* COLLECTIONS COLUMN — now the OBJECT SWITCHER */}
        <div
          style={{
            flex: "none",
            width: 236,
            background: "var(--surface2)",
            borderRight: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "13px 14px", overflowY: "auto", flex: 1 }}>
            <div
              style={{
                font: "700 8.5px/1 var(--mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              Workspace objects
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 9 }}>
              {OBJECTS.map((o) => {
                const on = objId === o.id;
                const oState = states[o.id];
                const oIdx = maturityIndex(oState.props, markets[o.id], oState.published, o.schema);
                return (
                  <button
                    key={o.id}
                    className="coll"
                    aria-pressed={on}
                    onClick={() => setObjId(o.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 9px",
                      borderRadius: 8,
                      background: on ? "#fff" : "transparent",
                      border: `1px solid ${on ? "var(--line)" : "transparent"}`,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: o.dot, flex: "none" }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                      <span style={{ font: `${on ? 600 : 500} 12px/1 var(--sans)`, color: on ? "var(--ink)" : "var(--onyx)" }}>
                        {o.schema.label}
                      </span>
                      <span style={{ font: "500 8px/1 var(--mono)", color: "var(--faint)" }}>
                        {o.schema.glyph} {o.ref}
                      </span>
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        font: "700 8px/1 var(--mono)",
                        color: "#fff",
                        background: MAT_COLORS[oIdx],
                        borderRadius: 5,
                        padding: "3px 5px",
                      }}
                    >
                      {oIdx}/9
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                font: "700 8.5px/1 var(--mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--faint)",
                marginTop: 18,
              }}
            >
              Explore
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 9 }}>
              {["◔ Relationship Explorer", "⟲ Activity Stream", "▤ Archived · Shared"].map((label) => (
                <div
                  key={label}
                  className="coll"
                  style={{ padding: "7px 9px", borderRadius: 8, font: "500 12px/1 var(--sans)", color: "var(--onyx)" }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              flex: "none",
              padding: "11px 14px",
              borderTop: "1px solid var(--line)",
              font: "500 9px/1.5 var(--mono)",
              color: "var(--faint)",
            }}
          >
            One runtime · objects projected here via EPR-001
          </div>
        </div>

        {/* UNIVERSAL WORKSPACE (center) — projection of the hosted object */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {/* object header */}
          <div style={{ flex: "none", background: "#fff", borderBottom: "1px solid var(--line)", padding: "13px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ font: "600 16px/1.1 var(--sans)", color: "var(--ink)" }}>{schema.label}</div>
                <div style={{ font: "500 8px/1 var(--mono)", letterSpacing: ".06em", color: "var(--faint)", marginTop: 4 }}>
                  UNIVERSAL WORKSPACE · HOSTING {(schema.studio || "STUDIO").toUpperCase()} · obj {host.ref}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button
                  className="cap"
                  onClick={() => setMarkets((m) => ({ ...m, [objId]: { ...m[objId], on: !m[objId].on } }))}
                >
                  {market.on ? "Market-Aware ✓" : "Enable Market"}
                </button>
                <button
                  className="cap primary"
                  onClick={togglePublish}
                  disabled={ready < 85}
                  title={ready < 85 ? "Reach 85% readiness to publish" : "Publish"}
                  style={ready < 85 ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                >
                  {state.published ? "Published ✓" : "Publish"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
              <span className="smart" style={{ background: matColor, color: "#fff", borderColor: matColor }}>
                ◆ {matName} · {matIdx}/9
              </span>
              <span
                className="smart"
                style={{ borderColor: "var(--teal-ln)", background: "var(--teal-tint)", color: "var(--teal-dark)" }}
              >
                🟢 {ready}% ready
              </span>
              <span className="smart">✦ evidence {sections.reduce((a, s) => a + s.fields.reduce((b, f) => b + f.evN, 0), 0)}</span>
              <span className="smart">⟲ {state.evolveCount} evolutions</span>
              {missing.length > 0 && (
                <span className="smart" style={{ borderColor: "#ecdca0", background: "#fbf3d2", color: "#7a5a00" }}>
                  ⚐ {missing.length} required to resolve
                </span>
              )}
            </div>
          </div>

          {/* projection canvas — schema-driven sections over the runtime */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 40px" }}>
            <div
              style={{
                font: "700 8.5px/1 var(--mono)",
                letterSpacing: ".07em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              Enterprise Object Projection
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 11 }}>
              {sections.map((sec) => (
                <div key={sec.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 8px" }}>
                    <span style={{ font: "700 8.5px/1 var(--mono)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
                      {sec.name}
                    </span>
                    <span style={{ marginLeft: "auto", font: "700 8px/1 var(--mono)", color: sec.doneColor }}>{sec.doneLabel}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {sec.fields.map((f) => (
                      <div className="card" key={f.key}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ font: "600 12px/1 var(--sans)", color: "var(--ink)" }}>
                            {f.label}
                            {f.req && <span style={{ color: "var(--jasper, #db504a)" }}> *</span>}
                          </span>
                          <span style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
                            {f.hasValue && (
                              <>
                                <span className="badge" style={{ color: f.srcColor, background: f.srcBg, border: `1px solid ${f.srcBorder}` }}>
                                  {f.srcLabel}
                                </span>
                                <span className="badge" style={{ color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)" }}>
                                  conf {f.confText}
                                </span>
                              </>
                            )}
                            {!f.hasValue && (
                              <button className="chip" style={{ borderStyle: "dashed" }} onClick={() => aiFill(f.key, f.label)}>
                                ✦ AI fill
                              </button>
                            )}
                          </span>
                        </div>

                        {/* value chips — single-select or multi-select per the schema */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {f.chips.length > 0 ? (
                            f.chips.map((c) => (
                              <button
                                key={c.label}
                                className={`chip${c.selected ? " on" : ""}`}
                                aria-pressed={c.selected}
                                onClick={() => (f.kind === "multi" ? toggleMulti(f.key, c.label) : setSingle(f.key, c.label, "suggestion"))}
                              >
                                {c.label}
                              </button>
                            ))
                          ) : (
                            <span style={{ font: "400 11px/1.4 var(--mono)", color: "var(--faint)" }}>
                              {f.hasValue ? String(Array.isArray(f.value) ? (f.value as string[]).join(", ") : f.value) : "not yet resolved"}
                            </span>
                          )}
                        </div>

                        {f.evN > 0 && (
                          <div style={{ marginTop: 8, font: "400 9px/1.5 var(--mono)", color: "var(--faint)" }}>
                            ✦ {f.evN} evidence · {f.evidence.slice(-1)[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ADVISOR + INSPECTOR (right) — projections over the runtime */}
        <div
          style={{
            flex: "none",
            width: 322,
            background: "var(--surface2)",
            borderLeft: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* advisor */}
          <div style={{ flex: "none", padding: "13px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: "var(--navy)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "700 9px/1 var(--mono)",
                }}
              >
                A
              </span>
              <span style={{ font: "600 12px/1 var(--sans)", color: "var(--ink)" }}>Advisor</span>
              <span style={{ marginLeft: "auto", font: "500 8px/1 var(--mono)", color: "var(--faint)" }}>next best evolution</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {advisor.length === 0 && (
                <div style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--faint)", padding: "6px 2px" }}>
                  No pending evolutions — this object is fully advanced.
                </div>
              )}
              {advisor.map((r) => (
                <button key={`${r.kind}-${r.key}`} className="rec" onClick={() => acceptAdvisor(r)}>
                  <span style={{ font: "500 11.5px/1.3 var(--sans)", color: "var(--ink)" }}>{r.label}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      font: "700 9px/1 var(--mono)",
                      color: "var(--jade)",
                      background: "#e2f5ee",
                      border: "1px solid #b7e6d5",
                      borderRadius: 5,
                      padding: "4px 6px",
                    }}
                  >
                    +{r.gain}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* inspector tabs */}
          <div
            role="tablist"
            aria-label="Inspector"
            style={{ flex: "none", display: "flex", gap: 3, padding: "9px 12px 0", borderBottom: "1px solid var(--line)" }}
          >
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={on}
                  className="tab"
                  onClick={() => setTab(t.key)}
                  style={{
                    font: "600 11px/1 var(--sans)",
                    padding: "8px 9px",
                    border: "none",
                    background: "transparent",
                    borderBottom: `2px solid ${on ? "var(--navy)" : "transparent"}`,
                    color: on ? "var(--ink)" : "var(--muted)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "13px 14px" }} role="tabpanel">
            <div
              style={{
                font: "700 8.5px/1 var(--mono)",
                letterSpacing: ".07em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              {INSP_TITLE[tab]}
            </div>

            {tab === "props" && (
              <div className="kv" style={{ marginTop: 10 }}>
                <span className="k">object</span>
                <span className="v">{host.ref}</span>
                <span className="k">type</span>
                <span className="v">{schema.label}</span>
                <span className="k">maturity</span>
                <span className="v" style={{ color: matColor }}>{matName}</span>
                <span className="k">status</span>
                <span className="v" style={{ color: state.published ? "#00713f" : "var(--muted)" }}>
                  {state.published ? "published" : "draft"}
                </span>
                <span className="k">evolutions</span>
                <span className="v">{state.evolveCount}</span>
                <span className="k">readiness</span>
                <span className="v" style={{ color: ready >= 85 ? "#00713f" : "#9a6b00" }}>{ready}%</span>
                <span className="k">required left</span>
                <span className="v">{missing.length}</span>
              </div>
            )}

            {tab === "evidence" && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {sections.flatMap((s) => s.fields).filter((f) => f.evN > 0).length === 0 && (
                  <div style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--faint)" }}>
                    No evidence yet. Accept an AI suggestion or advisor action to record provenance.
                  </div>
                )}
                {sections
                  .flatMap((s) => s.fields)
                  .filter((f) => f.evN > 0)
                  .map((f) => (
                    <div
                      key={f.key}
                      style={{ border: "1px solid var(--teal-ln)", background: "var(--teal-tint)", borderRadius: 9, padding: "10px 12px" }}
                    >
                      <div style={{ font: "600 11px/1 var(--sans)", color: "var(--teal-dark)" }}>{f.label}</div>
                      <div style={{ font: "500 10px/1.5 var(--mono)", color: "var(--muted)", marginTop: 5 }}>
                        source: {f.srcLabel} · confidence {f.confText}
                        <br />
                        {f.evidence.map((e, i) => (
                          <span key={i}>
                            • {e}
                            <br />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {tab === "timeline" && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 10 }}>
                {state.activity.length === 0 && (
                  <div style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--faint)" }}>No timeline events yet.</div>
                )}
                {state.activity.map((e, i) => (
                  <div key={`${e.text}-${i}`} style={{ display: "flex", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, marginTop: 4, flex: "none" }} />
                    <div>
                      <div style={{ font: "600 11px/1.2 var(--sans)", color: "var(--ink)" }}>{e.text}</div>
                      <div style={{ font: "400 9px/1 var(--mono)", color: "var(--faint)", marginTop: 3 }}>{e.src}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                {state.activity.length === 0 && (
                  <div style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--faint)" }}>No governed activity yet.</div>
                )}
                {state.activity.map((a, i) => (
                  <div key={`${a.text}-${i}`} style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--muted)" }}>
                    {a.text}
                    <span style={{ color: "var(--faint)" }}> · {a.src}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
