"use client";

/**
 * STD-UX-0001 reference surface. It DOCUMENTS the Enterprise Interaction Canon by
 * projecting the machine-readable canon module (so the page can never drift from
 * the standard) and DOGFOODS it by mounting the live ObjectActionBar primitive.
 */

import { useState } from "react";
import {
  CANON_PARTS, CANON_STACK, OBJECT_ACTIONS, EVOLUTION_LIFECYCLE,
  type Normativity,
} from "@/lib/std-ux/canon";
import { ObjectActionBar } from "@/components/lawrence/epr/ObjectActionBar";

const LEVEL_TONE: Record<Normativity, { fg: string; bg: string; bd: string }> = {
  MUST: { fg: "#8a1c16", bg: "#fbe9e8", bd: "#f1c4c0" },
  "MUST NOT": { fg: "#8a1c16", bg: "#fbe9e8", bd: "#f1c4c0" },
  SHALL: { fg: "#0a5c5d", bg: "#e6f6f6", bd: "#bde6e6" },
  SHOULD: { fg: "#6b5a00", bg: "#fdf4cf", bd: "#ecdd8f" },
};

export function InteractionCanon() {
  const [log, setLog] = useState<string[]>([]);
  function record(note: string) {
    setLog((l) => [note, ...l].slice(0, 6));
  }

  return (
    <div className="lds" style={{ minHeight: "100vh", background: "var(--canvas, #edf2f5)", fontFamily: "var(--font, Poppins, Arial, sans-serif)", color: "#33424f" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#09375f,#0a2a47)", color: "#fff", padding: "26px 32px" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, opacity: 0.7 }}>STD-UX-0001</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: 24, fontWeight: 700 }}>LAWRENCE Enterprise Interaction Canon</h1>
        <p style={{ margin: 0, maxWidth: 760, fontSize: 13.5, lineHeight: 1.55, opacity: 0.85 }}>
          The constitutional <strong>interaction</strong> contract — distinct from LDS-001 visual language and the EPR object runtime.
          It defines behavior every Host Runtime, Studio, Domain Pack, Projection, and Advisor MUST implement. Not styling. Not layout.
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, padding: 22, flexWrap: "wrap" }}>
        <main style={{ flex: "1 1 620px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* DOGFOOD: the live Part III primitive */}
          <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#09375f" }}>Live: the inherited Object Action Bar</h2>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "#6b7a8a" }}>Part III · dogfooded</span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#6b7a8a" }}>
              This is the real primitive every Enterprise Object inherits. Try <strong>Evolve</strong> (the signature LAWRENCE action),
              or open the overflow for the full governed action set.
            </p>
            <ObjectActionBar
              objectLabel="Candidate · Grace Hopper"
              objectGlyph="⟨Candidate⟩"
              referenceId="candidate/demo"
              onEvolve={() => record("Evolve · advanced to next maturity state (governed)")}
              nextEvolution="Benchmark expectations against market"
              onAskAdvisor={() => record("Ask Advisor · reasoning over the object")}
              onCompare={() => record("Compare · opened side-by-side")}
              onActivity={record}
            />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#9aa7b4", marginBottom: 6 }}>OBJECT ACTIVITY (governed)</div>
              {log.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9aa7b4" }}>No actions yet — every action above emits a governed activity entry.</div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {log.map((l, i) => (
                    <li key={i} style={{ fontSize: 12, color: "#33424f", fontFamily: "JetBrains Mono, monospace" }}>· {l}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* The six behavioral domains */}
          {CANON_PARTS.map((part) => (
            <section key={part.id} style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 18 }} data-part={part.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#44b0b1", fontWeight: 700 }}>{part.numeral}</span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09375f" }}>{part.title}</h2>
              </div>
              <p style={{ margin: "6px 0 12px", fontSize: 13, color: "#46586a", fontStyle: "italic" }}>{part.thesis}</p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {part.vocabulary.map((v) => (
                  <span key={v} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "#f4f7fa", border: "1px solid #e1e8ef", color: "#46586a" }}>{v}</span>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {part.contracts.map((c, i) => {
                  const tone = LEVEL_TONE[c.level];
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: tone.fg, background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 5, padding: "2px 6px", marginTop: 1 }}>
                        {c.level}
                      </span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#33424f" }}>{c.text}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </main>

        {/* Reference rail */}
        <aside style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#09375f" }}>Inherited Object Actions</h3>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#6b7a8a" }}>Part III — identical on every object.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {OBJECT_ACTIONS.map((a) => (
                <div key={a.kind} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }} title={a.contract}>
                  <span style={{ flex: 1, fontWeight: a.signature ? 700 : 500, color: a.signature ? "#0a5c5d" : "#33424f" }}>{a.label}</span>
                  {a.signature && <span style={{ fontSize: 9, fontWeight: 800, background: "#063a3a", color: "#9ff0ef", borderRadius: 4, padding: "1px 5px" }}>LAWRENCE</span>}
                  {a.governed && <span style={{ fontSize: 9, fontWeight: 700, color: "#0a5c5d", background: "#e6f6f6", border: "1px solid #bde6e6", borderRadius: 4, padding: "1px 5px" }}>governed</span>}
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#09375f" }}>Object Evolution lifecycle</h3>
            <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
              {EVOLUTION_LIFECYCLE.map((s) => (
                <li key={s} style={{ fontSize: 12, color: "#46586a" }}>{s}</li>
              ))}
            </ol>
          </section>

          <section style={{ background: "#fff", border: "1px solid #d9e1ea", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#09375f" }}>Constitutional stack</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CANON_STACK.map((s) => (
                <div key={s.id} style={{
                  fontSize: 11.5, padding: "7px 9px", borderRadius: 7,
                  background: s.current ? "#e6f6f6" : "#f4f7fa",
                  border: s.current ? "1px solid #44b0b1" : "1px solid #e1e8ef",
                }}>
                  <div style={{ fontWeight: s.current ? 700 : 600, color: s.current ? "#0a5c5d" : "#33424f" }}>{s.label}</div>
                  <div style={{ color: "#7a8794", marginTop: 1 }}>{s.role}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
