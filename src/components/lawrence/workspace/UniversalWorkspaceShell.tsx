"use client";

/* ============================================================================
   LAWRENCE Universal Workspace Shell — first-class LDS-001 surface.

   The mockup's thesis: there is ONE workspace shell. Studios (Job, Candidate, …)
   are not separate apps — they are object projections HOSTED inside this shell.
   The header, 60px nav rail, collections column, center projection canvas, and
   advisor/inspector rail persist; only the center projection changes per object.

   This is a faithful, interactive React port. Nav rail, collections, inspector
   tabs, projection chips, and advisor actions are all live state; selecting a
   non-default value on a projection field records governed evidence + activity.
   ========================================================================== */

import { useState } from "react";
import "./universal-workspace.css";

type NavKey = "search" | "objects" | "pinned" | "advisor" | "diag" | "activity";
type TabKey = "props" | "evidence" | "timeline" | "activity";

interface ActivityEntry {
  text: string;
  source: string;
}

const RAIL: { key: NavKey; name: string; glyph: string }[] = [
  { key: "search", name: "Search", glyph: "⌕" },
  { key: "objects", name: "Objects", glyph: "◳" },
  { key: "pinned", name: "Pinned", glyph: "★" },
  { key: "advisor", name: "Advisor", glyph: "◆" },
  { key: "diag", name: "Diagnostics", glyph: "⚐" },
  { key: "activity", name: "Activity", glyph: "⟲" },
];

const COLLECTIONS: { key: string; label: string; count: string; dot: string }[] = [
  { key: "assigned", label: "Assigned to me", count: "12", dot: "#09375f" },
  { key: "review", label: "Needs review", count: "5", dot: "#9a6b00" },
  { key: "drafts", label: "Drafts", count: "8", dot: "#93a1b0" },
  { key: "active", label: "Active work", count: "23", dot: "#00875f" },
  { key: "pinned", label: "Pinned", count: "4", dot: "#44b0b1" },
  { key: "recents", label: "Recents", count: "", dot: "#cdd7e2" },
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
  const [coll, setColl] = useState("assigned");
  const [tab, setTab] = useState<TabKey>("props");

  // Governed projection field selections. The center canvas is a projection of
  // a Job enterprise object; changing a field value is an authored decision.
  const [title, setTitle] = useState("Senior Power BI Developer");
  const [comp, setComp] = useState("$150–172k");

  const [activity, setActivity] = useState<ActivityEntry[]>([
    { text: "A. Chen set Compensation band", source: "market" },
    { text: 'Advisor proposed "Request approval"', source: "ai" },
    { text: "Linked 2 candidates", source: "references" },
  ]);

  function logActivity(text: string, source: string) {
    setActivity((prev) => [{ text, source }, ...prev]);
  }

  function chooseTitle(next: string) {
    if (next === title) return;
    setTitle(next);
    logActivity(`A. Chen set Job Title → ${next}`, "decision");
  }
  function chooseComp(next: string) {
    if (next === comp) return;
    setComp(next);
    logActivity(`A. Chen set Compensation band → ${next}`, "market");
  }

  const capabilities: { label: string; primary?: boolean }[] = [
    { label: "Publish", primary: true },
    { label: "Generate JD" },
    { label: "Benchmark" },
    { label: "Request Approval" },
  ];

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
          <span style={{ color: "#7fe0d6", font: "700 9px/1 var(--mono)" }}>⟨Job⟩</span> {title}{" "}
          <span style={{ color: "#6f93b4" }}>/ Job Studio</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              font: "600 9px/1 var(--mono)",
              color: "#7fe0d6",
              background: "rgba(68,176,177,.16)",
              border: "1px solid rgba(68,176,177,.35)",
              borderRadius: 6,
              padding: "6px 9px",
            }}
          >
            ◆ Market-Aware · 86%
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

        {/* COLLECTIONS COLUMN */}
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
              Collections
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 9 }}>
              {COLLECTIONS.map((c) => {
                const on = coll === c.key;
                return (
                  <button
                    key={c.key}
                    className="coll"
                    aria-pressed={on}
                    onClick={() => setColl(c.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 9px",
                      borderRadius: 8,
                      background: on ? "#fff" : "transparent",
                      border: `1px solid ${on ? "var(--line)" : "transparent"}`,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 3,
                        background: c.dot,
                        flex: "none",
                      }}
                    />
                    <span
                      style={{
                        font: `${on ? 600 : 500} 12px/1 var(--sans)`,
                        color: on ? "var(--ink)" : "var(--onyx)",
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      style={{ marginLeft: "auto", font: "600 9px/1 var(--mono)", color: "var(--faint)" }}
                    >
                      {c.count}
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
              {[
                "◔ Relationship Explorer",
                "⟲ Activity Stream",
                "▤ Archived · Shared",
              ].map((label) => (
                <div
                  key={label}
                  className="coll"
                  style={{
                    padding: "7px 9px",
                    borderRadius: 8,
                    font: "500 12px/1 var(--sans)",
                    color: "var(--onyx)",
                  }}
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
            Objects live in the Object Store · projected here
          </div>
        </div>

        {/* UNIVERSAL WORKSPACE (center) */}
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
          <div
            style={{
              flex: "none",
              background: "#fff",
              borderBottom: "1px solid var(--line)",
              padding: "13px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ font: "600 16px/1.1 var(--sans)", color: "var(--ink)" }}>{title}</div>
                <div
                  style={{
                    font: "500 8px/1 var(--mono)",
                    letterSpacing: ".06em",
                    color: "var(--faint)",
                    marginTop: 4,
                  }}
                >
                  UNIVERSAL WORKSPACE · HOSTING JOB STUDIO · obj job:JR-118
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 7, flexWrap: "wrap" }}>
                {capabilities.map((c) => (
                  <button
                    key={c.label}
                    className={`cap${c.primary ? " primary" : ""}`}
                    onClick={() => logActivity(`Capability invoked · ${c.label}`, "capability")}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
              <span className="smart">🏢 Aberdeen Health</span>
              <span className="smart">📍 Remote</span>
              <span className="smart">💰 {comp}</span>
              <span className="smart">⚡ Tier 1</span>
              <span
                className="smart"
                style={{ borderColor: "var(--teal-ln)", background: "var(--teal-tint)", color: "var(--teal-dark)" }}
              >
                🟢 86% ready
              </span>
            </div>
          </div>

          {/* projection canvas */}
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
              {/* Job Title */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: "600 12px/1 var(--sans)", color: "var(--ink)" }}>Job Title</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                    <span className="badge" style={{ color: "#0c6fb0", background: "#e6f4fb", border: "1px solid #bfe3f5" }}>
                      suggestion
                    </span>
                    <span className="badge" style={{ color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)" }}>
                      conf 1.00
                    </span>
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {["Senior Power BI Developer", "Azure Architect", "Staff SRE"].map((opt) => (
                    <button
                      key={opt}
                      className={`chip${title === opt ? " on" : ""}`}
                      aria-pressed={title === opt}
                      onClick={() => chooseTitle(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked candidates */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: "600 12px/1 var(--sans)", color: "var(--ink)" }}>Linked candidates</span>
                  <span style={{ font: "700 7.5px/1 var(--mono)", color: "var(--faint)" }}>
                    RELATIONSHIP · ⟨Candidate⟩ · N:N
                  </span>
                  <span className="badge" style={{ marginLeft: "auto", color: "#0a5c5d", background: "#e6f6f6", border: "1px solid #bde6e6" }}>
                    ❖ 2
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {["Jordan Ellis", "Diego Marin"].map((name) => (
                    <span
                      key={name}
                      className="smart"
                      style={{ borderColor: "var(--teal-ln)", background: "var(--teal-tint)", color: "var(--teal-dark)" }}
                    >
                      <span
                        style={{
                          font: "700 8px/1 var(--mono)",
                          color: "var(--navy)",
                          background: "#fff",
                          border: "1px solid var(--line)",
                          borderRadius: 4,
                          padding: "3px 4px",
                        }}
                      >
                        ⟨Candidate⟩
                      </span>{" "}
                      {name}
                    </span>
                  ))}
                  <button className="chip" style={{ borderStyle: "dashed" }} onClick={() => logActivity("Linked a candidate", "references")}>
                    ＋ link candidate…
                  </button>
                </div>
              </div>

              {/* Compensation band */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: "600 12px/1 var(--sans)", color: "var(--ink)" }}>Compensation band</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                    <span className="badge" style={{ color: "#0c6fb0", background: "#e6f4fb", border: "1px solid #bfe3f5" }}>
                      market
                    </span>
                    <span className="badge" style={{ color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)" }}>
                      conf 0.92
                    </span>
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {["$120–140k", "$150–172k", "$180–210k"].map((opt) => (
                    <button
                      key={opt}
                      className={`chip${comp === opt ? " on" : ""}`}
                      aria-pressed={comp === opt}
                      onClick={() => chooseComp(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ADVISOR + INSPECTOR (right) */}
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
              <span style={{ marginLeft: "auto", font: "500 8px/1 var(--mono)", color: "var(--faint)" }}>
                next best evolution
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {[
                { label: "Request approval", lift: "+6" },
                { label: "Generate JD", lift: "+4" },
              ].map((r) => (
                <button key={r.label} className="rec" onClick={() => logActivity(`Advisor action accepted · ${r.label}`, "ai")}>
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
                    {r.lift}
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
                <span className="v">job:JR-118</span>
                <span className="k">type</span>
                <span className="v">Job</span>
                <span className="k">maturity</span>
                <span className="v" style={{ color: "var(--teal-dark)" }}>Market-Aware</span>
                <span className="k">status</span>
                <span className="v" style={{ color: "#00713f" }}>active</span>
                <span className="k">owner</span>
                <span className="v">A. Chen</span>
                <span className="k">properties</span>
                <span className="v">14 · 2 refs</span>
                <span className="k">readiness</span>
                <span className="v" style={{ color: "#00713f" }}>86%</span>
              </div>
            )}

            {tab === "evidence" && (
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid var(--teal-ln)",
                  background: "var(--teal-tint)",
                  borderRadius: 9,
                  padding: "10px 12px",
                }}
              >
                <div style={{ font: "600 11px/1 var(--sans)", color: "var(--teal-dark)" }}>
                  Comp band — {title}
                </div>
                <div style={{ font: "500 10px/1.5 var(--mono)", color: "var(--muted)", marginTop: 5 }}>
                  selected: {comp}
                  <br />
                  factors: market median · client history
                  <br />
                  sources: 3 · confidence 0.92
                </div>
              </div>
            )}

            {tab === "timeline" && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { dot: "var(--teal)", title: "Market benchmarked", meta: "09:24 · market" },
                  { dot: "var(--navy)", title: "Linked ⟨Candidate⟩ Jordan Ellis", meta: "09:20 · references" },
                ].map((e) => (
                  <div key={e.title} style={{ display: "flex", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.dot, marginTop: 4, flex: "none" }} />
                    <div>
                      <div style={{ font: "600 11px/1.2 var(--sans)", color: "var(--ink)" }}>{e.title}</div>
                      <div style={{ font: "400 9px/1 var(--mono)", color: "var(--faint)", marginTop: 3 }}>{e.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                {activity.map((a, i) => (
                  <div key={`${a.text}-${i}`} style={{ font: "500 10.5px/1.4 var(--sans)", color: "var(--muted)" }}>
                    {a.text}
                    <span style={{ color: "var(--faint)" }}> · {a.source}</span>
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
