"use client";

import { useState } from "react";
import type {
  PlatformProgram,
  ProgramReport,
  LiveRuntimeFacts,
  MilestoneEvaluation,
  MilestoneStatus,
  Epic,
  ReadinessStage,
} from "@/lib/platform-program";
import { DOD_DIMENSIONS } from "@/lib/platform-program";

type Section = "milestones" | "workstreams" | "sequence" | "backlog" | "self-hosting" | "readiness";

const SECTIONS: { id: Section; label: string; code: string }[] = [
  { id: "milestones", label: "Milestones", code: "01" },
  { id: "workstreams", label: "Workstreams", code: "02" },
  { id: "sequence", label: "Implementation Sequence", code: "03" },
  { id: "backlog", label: "Engineering Backlog", code: "04" },
  { id: "self-hosting", label: "Self-Hosting", code: "05" },
  { id: "readiness", label: "Production Readiness", code: "06" },
];

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="pg-mono">{children}</span>;
}

function StatusBadge({ status }: { status: MilestoneStatus }) {
  const tone =
    status === "complete" ? "good" : status === "in-progress" ? "warn" : status === "blocked" ? "bad" : "idle";
  return <span className={`pg-badge ${tone}`}>{status.replace("-", " ")}</span>;
}

export function PlatformProgramSurface({
  program,
  report,
  live,
}: {
  program: PlatformProgram;
  report: ProgramReport;
  live: LiveRuntimeFacts;
}) {
  const [section, setSection] = useState<Section>("milestones");
  const evalById = new Map(report.evaluations.map((e) => [e.milestone.id, e]));

  return (
    <div className="pg-root">
      <Style />
      {/* Header */}
      <header className="pg-header">
        <div className="pg-header-main">
          <Mono>LAWRENCE · PLATFORM ENGINEERING PROGRAM</Mono>
          <h1 className="pg-title">
            BUILDING A SELF-HOSTING<br />CONSTITUTIONAL ENTERPRISE OS
          </h1>
          <p className="pg-sub">
            The executable backlog. Milestones are ordered by architectural dependency, not feature priority.
            Status is reconciled live against the running runtime — the program reports what is proven, not asserted.
          </p>
        </div>
        <div className="pg-header-kpis">
          <Kpi label="Version" value={report.generatedFor} />
          <Kpi label="Complete" value={`${report.totals.complete}/${program.milestones.length}`} />
          <Kpi label="Blocked" value={String(report.totals.blocked)} tone={report.totals.blocked ? "bad" : "good"} />
          <Kpi label="Cycles" value={String(report.cycles.length)} tone={report.cycles.length ? "bad" : "good"} />
          <Kpi label="Critical path" value={`${report.criticalPath.length} hops`} tone="cyan" />
        </div>
      </header>

      {/* Section nav */}
      <nav className="pg-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`pg-nav-item ${section === s.id ? "active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            <span className="pg-nav-code">{s.code}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <main className="pg-main">
        {section === "milestones" && <Milestones report={report} />}
        {section === "workstreams" && <Workstreams program={program} />}
        {section === "sequence" && <Sequence program={program} report={report} />}
        {section === "backlog" && <Backlog program={program} evalById={evalById} />}
        {section === "self-hosting" && <SelfHosting program={program} />}
        {section === "readiness" && <Readiness program={program} report={report} live={live} />}
      </main>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="pg-kpi">
      <span className="pg-kpi-label">{label}</span>
      <span className={`pg-kpi-value ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

/* ---------------- 01 Milestones ---------------- */
function Milestones({ report }: { report: ProgramReport }) {
  const [open, setOpen] = useState<string | null>(report.evaluations[0]?.milestone.id ?? null);
  return (
    <div className="pg-stack">
      {report.evaluations.map((e) => (
        <MilestoneCard key={e.milestone.id} e={e} open={open === e.milestone.id} onToggle={() => setOpen(open === e.milestone.id ? null : e.milestone.id)} />
      ))}
    </div>
  );
}

function MilestoneCard({ e, open, onToggle }: { e: MilestoneEvaluation; open: boolean; onToggle: () => void }) {
  const m = e.milestone;
  return (
    <section className={`pg-card ${e.onCriticalPath ? "crit" : ""}`}>
      <button className="pg-card-head" onClick={onToggle} aria-expanded={open}>
        <Mono>{m.id}</Mono>
        <span className="pg-card-title">{m.label}</span>
        {e.onCriticalPath && <span className="pg-chip cyan">CRITICAL PATH</span>}
        <span className="pg-spacer" />
        <span className="pg-probe">{e.probesPassed}/{e.probesTotal} probes</span>
        <StatusBadge status={e.effectiveStatus} />
        <span className="pg-caret">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="pg-card-body">
          <Field label="Objective">{m.objective}</Field>
          <Field label="Architectural outcome">{m.architecturalOutcome}</Field>
          {e.blockedBy.length > 0 && (
            <Field label="Blocked by">
              <span className="pg-bad-text">{e.blockedBy.join(", ")} not complete</span>
            </Field>
          )}
          {e.failedProbeIds.length > 0 && (
            <Field label="Failing live probes">
              {m.probes.filter((p) => e.failedProbeIds.includes(p.id)).map((p) => (
                <div key={p.id} className="pg-probe-row bad">✗ {p.description}</div>
              ))}
            </Field>
          )}
          {e.probesPassed > 0 && (
            <Field label="Passing live probes">
              {m.probes.filter((p) => !e.failedProbeIds.includes(p.id)).map((p) => (
                <div key={p.id} className="pg-probe-row good">✓ {p.description}</div>
              ))}
            </Field>
          )}
          <div className="pg-cols">
            <ListField label="Runtime contracts">
              {m.runtimeContracts.map((c) => (
                <li key={c.name}>
                  <span className={`pg-dot ${c.state === "live" ? "good" : "idle"}`} />
                  {c.name} {c.note && <em className="pg-note">— {c.note}</em>}
                </li>
              ))}
            </ListField>
            <ListField label="Enterprise objects">
              {m.enterpriseObjects.length === 0 ? <li className="pg-muted">none</li> : m.enterpriseObjects.map((o) => (
                <li key={o.objectType}><span className={`pg-dot ${o.state === "live" ? "good" : "idle"}`} />{o.objectType}</li>
              ))}
            </ListField>
            <ListField label="UI surfaces">{m.uiSurfaces.map((s) => <li key={s}><Mono>{s}</Mono></li>)}</ListField>
          </div>
          <div className="pg-cols">
            <ListField label="Acceptance criteria">{m.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}</ListField>
            <ListField label="Constitutional gates">{m.constitutionalGates.map((a, i) => <li key={i}>{a}</li>)}</ListField>
          </div>
          <div className="pg-cols">
            <ListField label="Conformance tests">{m.conformanceTests.map((a, i) => <li key={i}><Mono>{a}</Mono></li>)}</ListField>
            <ListField label="Deliverables">{m.deliverables.map((a, i) => <li key={i}>{a}</li>)}</ListField>
          </div>
          <Field label="Definition of Done">
            <div className="pg-dod">
              {DOD_DIMENSIONS.map((d) => {
                const ok = e.dodSatisfied.includes(d.id);
                return <span key={d.id} className={`pg-dod-chip ${ok ? "good" : "idle"}`}>{ok ? "✓" : "○"} {d.label}</span>;
              })}
            </div>
          </Field>
        </div>
      )}
    </section>
  );
}

/* ---------------- 02 Workstreams ---------------- */
function Workstreams({ program }: { program: PlatformProgram }) {
  return (
    <div className="pg-ws-grid">
      {program.workstreams.map((w) => (
        <div key={w.id} className="pg-ws">
          <Mono>{w.id}</Mono>
          <h3 className="pg-ws-title">{w.label}</h3>
          <p className="pg-ws-charter">{w.charter}</p>
          <div className="pg-ws-deps">
            <span className="pg-kpi-label">Depends on</span>
            {w.dependsOn.length === 0 ? (
              <span className="pg-chip cyan">ROOT</span>
            ) : (
              w.dependsOn.map((d) => <span key={d} className="pg-chip">{d}</span>)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 03 Implementation Sequence ---------------- */
function Sequence({ program, report }: { program: PlatformProgram; report: ProgramReport }) {
  const byId = new Map(program.milestones.map((m) => [m.id, m]));
  const crit = new Set(report.criticalPath);
  return (
    <div className="pg-stack">
      <p className="pg-sub">
        Topologically ordered by architectural dependency. No milestone may begin until its required runtime
        contracts exist. The highlighted chain is the critical path — slipping any of these slips the program.
      </p>
      <ol className="pg-seq">
        {report.topologicalOrder.map((id, i) => {
          const m = byId.get(id)!;
          const e = report.evaluations.find((x) => x.milestone.id === id)!;
          return (
            <li key={id} className={`pg-seq-row ${crit.has(id) ? "crit" : ""}`}>
              <span className="pg-seq-n">{String(i + 1).padStart(2, "0")}</span>
              <Mono>{id}</Mono>
              <span className="pg-seq-label">{m.label}</span>
              {crit.has(id) && <span className="pg-chip cyan">CRITICAL</span>}
              <span className="pg-spacer" />
              {m.dependsOn.length > 0 && <span className="pg-seq-dep">requires {m.dependsOn.join(" + ")}</span>}
              <StatusBadge status={e.effectiveStatus} />
            </li>
          );
        })}
      </ol>
      {report.cycles.length > 0 && (
        <div className="pg-card crit">
          <div className="pg-card-body">
            <Field label="Dependency cycles detected">
              <span className="pg-bad-text">{report.cycles.map((c) => c.join(" → ")).join(" | ")}</span>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 04 Engineering Backlog ---------------- */
function Backlog({ program, evalById }: { program: PlatformProgram; evalById: Map<string, MilestoneEvaluation> }) {
  const [sel, setSel] = useState<string>(program.milestones[0].id);
  const m = program.milestones.find((x) => x.id === sel)!;
  return (
    <div className="pg-backlog">
      <aside className="pg-backlog-rail">
        {program.milestones.map((mm) => (
          <button key={mm.id} className={`pg-backlog-tab ${sel === mm.id ? "active" : ""}`} onClick={() => setSel(mm.id)}>
            <Mono>{mm.id}</Mono> {mm.label}
            <span className="pg-backlog-count">{mm.epics.length}</span>
          </button>
        ))}
      </aside>
      <div className="pg-backlog-body">
        {m.epics.map((ep) => <EpicCard key={ep.id} ep={ep} />)}
      </div>
    </div>
  );
}

function EpicCard({ ep }: { ep: Epic }) {
  return (
    <section className="pg-epic">
      <div className="pg-epic-head"><Mono>{ep.id}</Mono><h4>{ep.label}</h4></div>
      <div className="pg-cols">
        <ListField label="User stories">{ep.userStories.map((s, i) => <li key={i}>{s}</li>)}</ListField>
        <ListField label="Technical tasks">{ep.technicalTasks.map((s, i) => <li key={i}>{s}</li>)}</ListField>
      </div>
      <div className="pg-cols">
        <ListField label="Runtime changes">{ep.runtimeChanges.map((s, i) => <li key={i}><Mono>{s}</Mono></li>)}</ListField>
        <ListField label="UI changes">{ep.uiChanges.map((s, i) => <li key={i}>{s}</li>)}</ListField>
      </div>
      <div className="pg-cols">
        <ListField label="Test requirements">{ep.testRequirements.map((s, i) => <li key={i}><Mono>{s}</Mono></li>)}</ListField>
        <ListField label="Risks">{ep.risks.map((s, i) => <li key={i} className="pg-bad-text">{s}</li>)}</ListField>
      </div>
      <Field label="Exit criteria">
        <ul className="pg-list">{ep.exitCriteria.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </Field>
    </section>
  );
}

/* ---------------- 05 Self-Hosting ---------------- */
function SelfHosting({ program }: { program: PlatformProgram }) {
  return (
    <div className="pg-stack">
      <p className="pg-sub">
        LAWRENCE begins building itself when these editors stop being bespoke code and become LAWRENCE-built,
        governed artifacts. The transition completes at M5–M6.
      </p>
      <div className="pg-sh-grid">
        {program.selfHosting.map((a) => (
          <div key={a.id} className={`pg-sh ${a.state}`}>
            <div className="pg-sh-head">
              <span className="pg-sh-title">{a.label}</span>
              <span className={`pg-badge ${a.state === "self-hosted" ? "good" : a.state === "partial" ? "warn" : "idle"}`}>{a.state}</span>
            </div>
            <p className="pg-sh-note">{a.note}</p>
            <Mono>self-hosts at {a.becomesSelfHostedAt}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 06 Production Readiness ---------------- */
function Readiness({ program, report }: { program: PlatformProgram; report: ProgramReport; live: LiveRuntimeFacts }) {
  const readyById = new Map(report.stageReadiness.map((s) => [s.stage as ReadinessStage, s]));
  return (
    <div className="pg-stack">
      {program.productionStages.map((st) => {
        const r = readyById.get(st.id)!;
        return (
          <section key={st.id} className={`pg-stage ${r.ready ? "ready" : ""}`}>
            <div className="pg-stage-head">
              <span className="pg-stage-title">{st.label}</span>
              <span className={`pg-badge ${r.ready ? "good" : "idle"}`}>{r.ready ? "READY" : "NOT READY"}</span>
              <span className="pg-spacer" />
              <span className="pg-probe">requires {st.requiresMilestones.join(" · ")}</span>
            </div>
            {!r.ready && <p className="pg-bad-text">Blocked by: {r.blockingMilestones.join(", ")}</p>}
            <div className="pg-stage-grid">
              <Req label="Performance" v={st.performance} />
              <Req label="Governance" v={st.governance} />
              <Req label="Replay" v={st.replay} />
              <Req label="Observability" v={st.observability} />
              <Req label="Security" v={st.security} />
              <Req label="Conformance" v={st.conformance} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Req({ label, v }: { label: string; v: string }) {
  return (
    <div className="pg-req">
      <span className="pg-kpi-label">{label}</span>
      <span className="pg-req-v">{v}</span>
    </div>
  );
}

/* ---------------- shared field primitives ---------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pg-field">
      <span className="pg-field-label">{label}</span>
      <div className="pg-field-body">{children}</div>
    </div>
  );
}
function ListField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pg-field">
      <span className="pg-field-label">{label}</span>
      <ul className="pg-list">{children}</ul>
    </div>
  );
}

/* ---------------- scoped styles (Palantir aesthetic) ---------------- */
function Style() {
  return (
    <style>{`
.pg-root { --bg:#0b0d0e; --bg2:#15191b; --ink:#f3f6f5; --muted:#828d8b; --line:rgba(255,255,255,0.14);
  --cyan:#8fe6d9; --cyan-dim:#2e6f68; --good:#8fe6d9; --warn:#e6c98f; --bad:#e68f8f;
  --display:"Helvetica Neue",Helvetica,Arial,"Segoe UI",Roboto,system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
  font-family:var(--display); color:var(--ink); background:var(--bg); min-height:100vh; }
.pg-mono { font-family:var(--mono); font-size:11px; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted); }
.pg-header { padding:48px 40px 28px; border-bottom:1px solid var(--line); display:flex; gap:40px; justify-content:space-between; flex-wrap:wrap; }
.pg-header-main { max-width:680px; display:flex; flex-direction:column; gap:14px; }
.pg-title { font-size:42px; line-height:1.02; font-weight:800; letter-spacing:-0.02em; margin:6px 0 0; text-wrap:balance; }
.pg-sub { color:var(--muted); font-size:14px; line-height:1.55; max-width:640px; }
.pg-header-kpis { display:flex; gap:10px; flex-wrap:wrap; align-content:flex-start; }
.pg-kpi { display:flex; flex-direction:column; gap:5px; padding:12px 14px; border:1px solid var(--line); border-radius:10px; min-width:104px; }
.pg-kpi-label { font-family:var(--mono); font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--muted); }
.pg-kpi-value { font-size:18px; font-weight:700; }
.pg-kpi-value.cyan, .pg-req-v.cyan { color:var(--cyan); }
.pg-kpi-value.good { color:var(--good); } .pg-kpi-value.bad { color:var(--bad); }
.pg-nav { display:flex; gap:2px; padding:0 40px; border-bottom:1px solid var(--line); overflow-x:auto; }
.pg-nav-item { background:none; border:none; color:var(--muted); padding:14px 16px; font-size:13px; cursor:pointer; display:flex; gap:8px; align-items:center; border-bottom:2px solid transparent; white-space:nowrap; }
.pg-nav-item:hover { color:var(--ink); }
.pg-nav-item.active { color:var(--ink); border-bottom-color:var(--cyan); }
.pg-nav-code { font-family:var(--mono); font-size:10px; color:var(--cyan-dim); }
.pg-main { padding:32px 40px 80px; max-width:1180px; }
.pg-stack { display:flex; flex-direction:column; gap:14px; }
.pg-spacer { flex:1; }
.pg-card { border:1px solid var(--line); border-radius:12px; background:var(--bg2); overflow:hidden; }
.pg-card.crit { border-color:var(--cyan-dim); }
.pg-card-head { width:100%; background:none; border:none; color:var(--ink); display:flex; align-items:center; gap:12px; padding:16px 18px; cursor:pointer; text-align:left; }
.pg-card-title { font-size:16px; font-weight:700; }
.pg-probe { font-family:var(--mono); font-size:11px; color:var(--muted); }
.pg-caret { font-family:var(--mono); color:var(--muted); width:14px; text-align:center; }
.pg-card-body { padding:4px 18px 20px; display:flex; flex-direction:column; gap:14px; border-top:1px solid var(--line); }
.pg-cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px; }
.pg-field { display:flex; flex-direction:column; gap:6px; }
.pg-field-label { font-family:var(--mono); font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--cyan-dim); }
.pg-field-body { font-size:14px; line-height:1.5; color:var(--ink); }
.pg-list { margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:5px; font-size:13px; line-height:1.45; }
.pg-list li { padding-left:14px; position:relative; color:var(--ink); }
.pg-list li::before { content:"·"; position:absolute; left:2px; color:var(--cyan-dim); }
.pg-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:7px; vertical-align:middle; }
.pg-dot.good { background:var(--good); } .pg-dot.idle { background:var(--muted); opacity:0.5; }
.pg-note { color:var(--muted); font-style:italic; font-size:12px; }
.pg-muted { color:var(--muted); }
.pg-badge { font-family:var(--mono); font-size:10px; letter-spacing:0.04em; text-transform:uppercase; padding:3px 8px; border-radius:5px; border:1px solid var(--line); }
.pg-badge.good { color:var(--good); border-color:var(--cyan-dim); }
.pg-badge.warn { color:var(--warn); border-color:#5a4a2a; }
.pg-badge.bad { color:var(--bad); border-color:#5a2a2a; }
.pg-badge.idle { color:var(--muted); }
.pg-chip { font-family:var(--mono); font-size:10px; text-transform:uppercase; padding:2px 7px; border:1px solid var(--line); border-radius:5px; color:var(--muted); }
.pg-chip.cyan { color:var(--cyan); border-color:var(--cyan-dim); }
.pg-probe-row { font-size:13px; padding:3px 0; }
.pg-probe-row.good { color:var(--good); } .pg-probe-row.bad { color:var(--bad); }
.pg-bad-text { color:var(--bad); font-size:13px; }
.pg-dod { display:flex; flex-wrap:wrap; gap:6px; }
.pg-dod-chip { font-family:var(--mono); font-size:10px; text-transform:uppercase; padding:3px 8px; border-radius:5px; border:1px solid var(--line); }
.pg-dod-chip.good { color:var(--good); border-color:var(--cyan-dim); }
.pg-dod-chip.idle { color:var(--muted); opacity:0.6; }
/* workstreams */
.pg-ws-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
.pg-ws { border:1px solid var(--line); border-radius:12px; padding:18px; background:var(--bg2); display:flex; flex-direction:column; gap:8px; }
.pg-ws-title { font-size:16px; font-weight:700; margin:2px 0; }
.pg-ws-charter { color:var(--muted); font-size:13px; line-height:1.5; flex:1; }
.pg-ws-deps { display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding-top:8px; border-top:1px solid var(--line); }
/* sequence */
.pg-seq { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.pg-seq-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--line); border-radius:10px; background:var(--bg2); }
.pg-seq-row.crit { border-color:var(--cyan-dim); }
.pg-seq-n { font-family:var(--mono); font-size:12px; color:var(--cyan-dim); }
.pg-seq-label { font-size:14px; font-weight:600; }
.pg-seq-dep { font-family:var(--mono); font-size:10px; color:var(--muted); text-transform:uppercase; }
/* backlog */
.pg-backlog { display:grid; grid-template-columns:220px 1fr; gap:20px; }
.pg-backlog-rail { display:flex; flex-direction:column; gap:4px; position:sticky; top:16px; align-self:start; }
.pg-backlog-tab { background:none; border:1px solid transparent; border-radius:8px; color:var(--muted); text-align:left; padding:10px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:8px; }
.pg-backlog-tab:hover { color:var(--ink); }
.pg-backlog-tab.active { color:var(--ink); border-color:var(--line); background:var(--bg2); }
.pg-backlog-count { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--cyan-dim); }
.pg-backlog-body { display:flex; flex-direction:column; gap:14px; }
.pg-epic { border:1px solid var(--line); border-radius:12px; padding:18px; background:var(--bg2); display:flex; flex-direction:column; gap:14px; }
.pg-epic-head { display:flex; align-items:center; gap:10px; }
.pg-epic-head h4 { font-size:15px; font-weight:700; margin:0; }
/* self-hosting */
.pg-sh-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
.pg-sh { border:1px solid var(--line); border-radius:12px; padding:16px; background:var(--bg2); display:flex; flex-direction:column; gap:8px; }
.pg-sh.self-hosted { border-color:var(--cyan-dim); }
.pg-sh-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.pg-sh-title { font-size:15px; font-weight:700; }
.pg-sh-note { color:var(--muted); font-size:13px; line-height:1.5; flex:1; }
/* readiness */
.pg-stage { border:1px solid var(--line); border-radius:12px; padding:18px; background:var(--bg2); display:flex; flex-direction:column; gap:12px; }
.pg-stage.ready { border-color:var(--cyan-dim); }
.pg-stage-head { display:flex; align-items:center; gap:12px; }
.pg-stage-title { font-size:17px; font-weight:700; }
.pg-stage-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
.pg-req { display:flex; flex-direction:column; gap:4px; padding-left:10px; border-left:2px solid var(--line); }
.pg-req-v { font-size:13px; line-height:1.45; }
@media (max-width:720px){ .pg-backlog{grid-template-columns:1fr;} .pg-title{font-size:30px;} }
`}</style>
  );
}
