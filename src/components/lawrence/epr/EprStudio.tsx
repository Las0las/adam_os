"use client";

/* ============================================================================
   EPR Studio — a PROJECTION over EPR-001.
   ----------------------------------------------------------------------------
   This single component renders ANY Enterprise Object. It owns NO property
   logic: maturity, readiness, evidence, advisory ranking and the mutation
   engine all live in src/lib/epr. Switching schema (Job <-> Candidate) proves
   "one runtime, any object — the Studio re-implements nothing."
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

export function EprStudio({ schema }: { schema: ObjectSchema }) {
  const [state, setState] = useState<EprState>(emptyState);
  const [market, setMarket] = useState<MarketState>({ on: false, label: "Lightcast" });

  // Every derived value is a PROJECTION — recomputed by the runtime, not stored.
  const sections = useMemo(() => buildSections(schema, state), [schema, state]);
  const advisor = useMemo(() => advisorItems(state.props, market, schema), [state.props, market, schema]);
  const missing = useMemo(() => missingReq(state.props, schema), [state.props, schema]);
  const ready = readiness(state.props, market, schema);
  const matIdx = maturityIndex(state.props, market, state.published, schema);

  function mutate(key: string, value: string | string[], src: Provenance, conf: number, ev: string | null) {
    setState((s) => applyEvolution(s, key, value, src, conf, ev, schema));
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
    // Deterministic "AI" fill from the field's first chip (evidence-backed).
    const f = schema.sections.flatMap((s) => s.fields).find((x) => x.key === key);
    const v = f?.kind === "multi" ? (f.chips || []).slice(0, 2) : (f?.chips?.[0] || "Generated");
    mutate(key, v, "ai", 0.92, `AI proposed ${label}`);
  }

  return (
    <div className="lds" style={{ minHeight: "100vh", background: "var(--canvas, #edf2f5)", fontFamily: "var(--font, Poppins, Arial, sans-serif)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Object header — maturity is computed, never asserted */}
        <header style={{ background: "linear-gradient(135deg,#09375f,#0a2a47)", color: "#fff", padding: "18px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, opacity: 0.7 }}>{schema.glyph}</span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{schema.label}</h1>
            <span
              style={{
                marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999,
                background: MAT_COLORS[matIdx], color: "#fff",
              }}
              data-testid="maturity"
            >
              ◆ {MATURITY[matIdx]} · {matIdx}/9
            </span>
            <button
              onClick={() => setMarket((m) => ({ ...m, on: !m.on }))}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontWeight: 600,
                border: "1px solid rgba(255,255,255,.3)", background: market.on ? "#44b0b1" : "transparent", color: "#fff",
              }}
            >
              {market.on ? "Market-Aware ✓" : "Enable Market"}
            </button>
            <button
              onClick={() => setState((s) => ({ ...s, published: !s.published }))}
              disabled={ready < 85}
              title={ready < 85 ? "Reach 85% readiness to publish" : "Publish"}
              style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 7, fontWeight: 700,
                cursor: ready < 85 ? "not-allowed" : "pointer", opacity: ready < 85 ? 0.45 : 1,
                border: "none", background: "#f7d002", color: "#09375f",
              }}
            >
              {state.published ? "Published" : "Publish"}
            </button>
          </div>
          {/* Readiness meter */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden" }}>
              <div style={{ width: `${ready}%`, height: "100%", background: ready >= 85 ? "#44b0b1" : "#f7d002", transition: "width .25s" }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace" }} data-testid="readiness">{ready}% ready</span>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: 20, flexWrap: "wrap" }}>
          {/* PROJECTION CANVAS */}
          <main style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 14 }}>
            {sections.map((sec) => (
              <section key={sec.id} style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#09375f" }}>{sec.name}</h2>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: sec.doneColor }}>{sec.doneLabel}</span>
                </div>
                {sec.hint && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7a8a" }}>{sec.hint}</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {sec.fields.map((f) => (
                    <div key={f.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#33424f" }}>
                          {f.label}{f.req && <span style={{ color: "#db504a" }}> *</span>}
                        </span>
                        {f.hasValue && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: f.srcColor, background: f.srcBg, border: `1px solid ${f.srcBorder}` }}>
                            {f.srcLabel} · {f.confText}
                          </span>
                        )}
                        {f.evN > 0 && (
                          <span title={f.evidence.join(" · ")} style={{ fontSize: 10, color: "#00875f", fontWeight: 600 }}>◆ {f.evN} evidence</span>
                        )}
                      </div>
                      {f.kind === "multi" && f.selected.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          {f.selected.map((v) => (
                            <button key={v} onClick={() => toggleMulti(f.key, v)}
                              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #44b0b1", background: "#e6f6f6", color: "#0a5c5d", cursor: "pointer", fontWeight: 600 }}>
                              {v} ×
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {f.chips.filter((c) => !c.selected).map((c) => (
                          <button key={c.label}
                            onClick={() => (f.kind === "multi" ? toggleMulti(f.key, c.label) : setSingle(f.key, c.label, "suggestion"))}
                            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #cdd9e3", background: "#f4f7fa", color: "#33424f", cursor: "pointer" }}>
                            {c.label}
                          </button>
                        ))}
                        <button onClick={() => aiFill(f.key, f.label)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid #bde6e6", background: "#e6f6f6", color: "#0a5c5d", cursor: "pointer", fontWeight: 600 }}>
                          ✦ AI
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </main>

          {/* ADVISOR + ACTIVITY rail */}
          <aside style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14 }}>
            <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#09375f" }}>Advisor</h3>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7a8a" }}>Next best evolution, ranked by maturity gain.</p>
              {advisor.length === 0 && <p style={{ fontSize: 12, color: "#00875f", margin: 0 }}>No outstanding recommendations.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {advisor.map((r) => (
                  <button key={r.key + r.kind}
                    onClick={() => (r.kind === "market" ? setMarket((m) => ({ ...m, on: true })) : aiFill(r.key, r.label))}
                    style={{ textAlign: "left", border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", background: "#fbfdff", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#33424f", flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#00875f" }}>+{r.gain}</span>
                  </button>
                ))}
              </div>
            </section>

            {missing.length > 0 && (
              <section style={{ background: "#fff7f6", border: "1px solid #f3c7c3", borderRadius: 12, padding: 14 }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#b5322b" }}>{missing.length} required to resolve</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {missing.map((m) => (
                    <span key={m.key} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#fdeceb", color: "#b5322b", border: "1px solid #f3c7c3" }}>{m.label}</span>
                  ))}
                </div>
              </section>
            )}

            <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#09375f" }}>Evolution log</h3>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7a8a" }}>{state.evolveCount} governed mutations.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {state.activity.length === 0 && <p style={{ fontSize: 12, color: "#93a1b0", margin: 0 }}>No mutations yet.</p>}
                {state.activity.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: a.color, flex: "0 0 auto" }} />
                    <span style={{ color: "#33424f" }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
