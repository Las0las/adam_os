"use client";

import { useState } from "react";
import type {
  AuthoritySummary,
  SampleDecision,
  ConformanceReport,
  ReconstructionReport,
  RuntimeSnapshot,
  RuntimeVersionGraph,
  JournalEntry,
} from "@/lib/kernel";
import type { ReplayProof } from "@/lib/projection-runtime";

export interface KernelExplorerModel {
  graph: RuntimeVersionGraph;
  conformance: ConformanceReport;
  reconstruction: ReconstructionReport;
  authorities: AuthoritySummary[];
  decision: SampleDecision;
  replay: ReplayProof;
  snapshot: RuntimeSnapshot;
  journal: JournalEntry[];
}

type Tab = "topology" | "authority" | "decisions" | "snapshots" | "replay" | "journal";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "topology", label: "Topology", blurb: "The runtime version graph — every runtime, its pinned version, dependencies, and formal contract." },
  { id: "authority", label: "Authority", blurb: "Live ExecutionAuthority issuance — the single currency every runtime spends to act." },
  { id: "decisions", label: "Decisions", blurb: "How an authorized intent decomposes into a concrete, ordered execution plan." },
  { id: "snapshots", label: "Snapshots", blurb: "The immutable, content-hashed capture that makes any execution reproducible bit-for-bit." },
  { id: "replay", label: "Replay & SB-7", blurb: "Determinism proof and whether the platform can rebuild its full state from canonical sources alone." },
  { id: "journal", label: "Journal", blurb: "The canonical append-only event stream — the system's total order and replay source." },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className ?? ""}`}>{children}</div>;
}

export function KernelExplorer({ model }: { model: KernelExplorerModel }) {
  const [tab, setTab] = useState<Tab>("topology");
  const { conformance, reconstruction, journal } = model;
  const failing = conformance.findings.filter((f) => !f.ok).length;

  return (
    <div className="stack">
      {/* KPI strip — the kernel's vital signs at a glance */}
      <div className="kx-kpis">
        <Kpi label="State root" value={reconstruction.stateRootHash} tone={reconstruction.reconstructable ? "good" : "bad"} />
        <Kpi label="Runtime graph" value={model.graph.graphHash} tone="accent" />
        <Kpi
          label="Conformance"
          value={`${conformance.descriptors.length} rt · ${failing} fail`}
          tone={conformance.conformant ? "good" : "bad"}
        />
        <Kpi
          label="Self-hosting (SB-7)"
          value={reconstruction.reconstructable ? "reconstructable" : "blocked"}
          tone={reconstruction.reconstructable ? "good" : "bad"}
        />
        <Kpi label="Journal" value={`${journal.length} events`} tone="neutral" />
      </div>

      <div className="seg" role="tablist" aria-label="Kernel explorer">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        {TABS.find((t) => t.id === tab)?.blurb}
      </p>

      {tab === "topology" && <TopologyTab model={model} />}
      {tab === "authority" && <AuthorityTab authorities={model.authorities} />}
      {tab === "decisions" && <DecisionsTab decision={model.decision} />}
      {tab === "snapshots" && <SnapshotsTab snapshot={model.snapshot} />}
      {tab === "replay" && <ReplayTab replay={model.replay} reconstruction={model.reconstruction} />}
      {tab === "journal" && <JournalTab journal={model.journal} />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="kx-kpi">
      <span className="kx-kpi-label">{label}</span>
      <span className={`badge ${tone}`} style={{ fontFamily: "var(--font-mono, monospace)" }}>{value}</span>
    </div>
  );
}

type Tone = "good" | "bad" | "warn" | "neutral" | "accent";

// ── Topology ─────────────────────────────────────────────────────────────────
function TopologyTab({ model }: { model: KernelExplorerModel }) {
  const { graph, conformance } = model;
  // Depth = longest dependency chain to a root, so the graph renders as layers.
  const depthOf = (id: string, seen: Set<string> = new Set()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const node = graph.nodes.find((n) => n.id === id);
    if (!node || node.dependsOn.length === 0) return 0;
    return 1 + Math.max(...node.dependsOn.map((d) => depthOf(d, new Set(seen))));
  };
  const descriptorFor = (id: string) => conformance.descriptors.find((d) => d.runtimeId === id);

  return (
    <div className="stack">
      <section>
        <h3 className="const-section-title">Runtime topology</h3>
        <p className="const-section-note">
          The kernel&apos;s process table. Every runtime sits at a fixed layer and may only depend downward — an
          acyclic hierarchy with the Constitution at the root. Versions are pinned; any change re-hashes the
          whole graph ({graph.graphHash}), so the exact lineage behind any execution is reconstructable.
        </p>
        <div className="const-list">
          {graph.nodes.map((n) => {
            const depth = depthOf(n.id);
            const d = descriptorFor(n.id);
            const declaredOnly = n.version.startsWith("0.");
            const findings = conformance.findings.filter((f) => f.runtimeId === n.id);
            const failed = findings.filter((f) => !f.ok);
            return (
              <Card key={n.id} className="const-row" >
                <div className="const-item-head" style={{ paddingLeft: depth * 18 }}>
                  {depth > 0 && <span className="kx-tree" aria-hidden>└</span>}
                  <span className={`badge ${declaredOnly ? "warn" : d ? "good" : "neutral"}`}>L{depth}</span>
                  <h4>{n.label}</h4>
                  <span className="spacer" />
                  <span className="const-derived" style={{ fontFamily: "var(--font-mono, monospace)" }}>
                    {n.id} v{n.version}
                  </span>
                </div>
                <div className="const-enforces">
                  {n.dependsOn.length === 0 ? (
                    <span className="badge accent">root</span>
                  ) : (
                    n.dependsOn.map((dep) => (
                      <span key={dep} className="badge neutral" title="depends on">→ {dep}</span>
                    ))
                  )}
                  {declaredOnly && <span className="badge warn" title="pinned below 1.0">declared · not yet built</span>}
                </div>
                {d && (
                  <div className="const-enforces">
                    <span className={`badge ${d.determinism === "deterministic" ? "good" : "bad"}`}>{d.determinism}</span>
                    <span className="badge neutral" title="host capabilities required">host: {d.hostRequirements.join(", ")}</span>
                    <span className="badge neutral" title="replay support">replay: {d.replaySupport}</span>
                    <span className={`badge ${failed.length === 0 ? "good" : "bad"}`}>
                      {findings.length - failed.length}/{findings.length} checks
                    </span>
                  </div>
                )}
                {d && (
                  <p className="const-derived">
                    {d.conformanceSuite.map((s) => `“${s}”`).join(" · ")}
                  </p>
                )}
                {failed.length > 0 && (
                  <div className="const-enforces">
                    {failed.map((f, i) => (
                      <span key={i} className="badge bad" title={f.article}>{f.detail}</span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Authority ────────────────────────────────────────────────────────────────
function AuthorityTab({ authorities }: { authorities: AuthoritySummary[] }) {
  return (
    <section>
      <h3 className="const-section-title">Issued execution authority</h3>
      <p className="const-section-note">
        Nothing in the platform acts without a signed, expiring ExecutionAuthority. Each row is a real intent
        submitted to the kernel and authorized against the Constitution — granted with explicit capabilities, or
        withheld. This is the kernel&apos;s answer to <em>&ldquo;may this happen?&rdquo;</em>
      </p>
      <div className="const-list">
        {authorities.map((a) => (
          <Card key={a.authorityId + a.scenario} className="const-row">
            <div className="const-item-head">
              <span className={`badge ${a.granted ? "good" : "bad"}`}>{a.outcome}</span>
              <h4>{a.scenario}</h4>
              <span className="spacer" />
              <span className="const-derived">{a.actorKind}</span>
            </div>
            <div className="const-enforces">
              {a.capabilities.length > 0 ? (
                a.capabilities.map((c) => <span key={c} className="badge neutral">{c}</span>)
              ) : (
                <span className="badge bad">no capabilities granted</span>
              )}
              {a.restrictions.map((r) => <span key={r} className="badge warn" title="restriction">{r}</span>)}
            </div>
            <p className="const-derived" style={{ fontFamily: "var(--font-mono, monospace)" }}>
              {a.authorityId} · sig {a.signature}
              {a.granted ? ` · expires ${a.expiresAt}` : ""}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── Decisions ──────────────────────────────────────────────────────────────
function DecisionsTab({ decision }: { decision: SampleDecision }) {
  return (
    <section>
      <h3 className="const-section-title">Decision plan</h3>
      <p className="const-section-note">
        Authority answers <em>&ldquo;may this happen?&rdquo;</em>; the Decision Runtime answers <em>&ldquo;exactly
        what will happen?&rdquo;</em> An authorized intent decomposes into a concrete, ordered plan the scheduler
        executes — each step spending a capability, each recorded.
      </p>
      <Card className="const-row">
        <div className="const-item-head">
          <span className="badge good">{decision.intentKind}</span>
          <h4>{decision.scenario}</h4>
          <span className="spacer" />
          <span className="const-derived" style={{ fontFamily: "var(--font-mono, monospace)" }}>{decision.decisionPlanId}</span>
        </div>
        <ol className="const-steps" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {decision.steps.map((s) => (
            <li key={s.id} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: s.id === decision.primaryStepId ? 600 : 400 }}>{s.label}</span>{" "}
              <span className={`badge ${s.execution === "immediate" ? "good" : "neutral"}`}>{s.execution}</span>
              {s.mutates && <span className="badge warn" title="performs a write">mutates</span>}
              {s.dependsOn.length > 0 && <span className="const-derived"> after {s.dependsOn.join(", ")}</span>}
              {s.id === decision.primaryStepId && <span className="badge accent">primary</span>}
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

// ── Snapshots ────────────────────────────────────────────────────────────────
function SnapshotsTab({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const rs = snapshot.runtimeState;
  return (
    <section>
      <h3 className="const-section-title">Runtime snapshot</h3>
      <p className="const-section-note">
        The single most important reproduction primitive: an immutable, fully-serializable capture of everything
        an execution depends on. The id is a content hash — identical inputs always yield {snapshot.snapshotId},
        so any drift (a version bump, a different actor) is detectable rather than silent.
      </p>
      <Card className="const-row">
        <div className="const-item-head">
          <span className="badge good">immutable</span>
          <h4>Reproduction context</h4>
          <span className="spacer" />
          <span className="const-derived" style={{ fontFamily: "var(--font-mono, monospace)" }}>{snapshot.snapshotId}</span>
        </div>
        <div className="kx-grid">
          <Field label="Captured at" value={snapshot.capturedAt} />
          <Field label="Runtime graph" value={snapshot.runtimeGraphHash} mono />
          <Field label="Authority" value={snapshot.authorityId} mono />
          <Field label="Decision" value={snapshot.decisionId} mono />
          <Field label="Enterprise" value={snapshot.enterpriseId} />
          <Field label="Host" value={`${snapshot.host.surface} @ ${snapshot.host.now}`} />
          <Field label="Surface / mode" value={`${rs.surface} · ${rs.mode}`} />
          <Field label="Locale" value={rs.locale ?? "—"} />
          <Field label="Operator" value={rs.user.displayName ?? rs.user.userId ?? "system"} />
          <Field label="Permissions" value={rs.permissions.join(", ") || "—"} />
        </div>
      </Card>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kx-field">
      <span className="kx-kpi-label">{label}</span>
      <span style={mono ? { fontFamily: "var(--font-mono, monospace)", fontSize: 12 } : { fontSize: 13 }}>{value}</span>
    </div>
  );
}

// ── Replay & SB-7 ──────────────────────────────────────────────────────────
function ReplayTab({ replay, reconstruction }: { replay: ReplayProof; reconstruction: ReconstructionReport }) {
  const blockers = reconstruction.hiddenStateRisks.filter((r) => r.severity === "blocker");
  return (
    <div className="stack">
      <section>
        <h3 className="const-section-title">Replay determinism</h3>
        <p className="const-section-note">
          Resolving the same projection twice under the same snapshot must yield a byte-identical plan — the
          guarantee that makes replay, caching, and AI reasoning sound.
        </p>
        <Card className="const-row">
          <div className="const-item-head">
            <span className={`badge ${replay.deterministic ? "good" : "bad"}`}>
              {replay.deterministic ? "deterministic" : "DRIFT DETECTED"}
            </span>
            <h4>Resolved {replay.projectionId} twice @ {replay.clock}</h4>
            <span className="spacer" />
            <span className="const-derived" style={{ fontFamily: "var(--font-mono, monospace)" }}>snapshot {replay.snapshotIdA}</span>
          </div>
          <div className="const-enforces">
            <span className="badge neutral" title="fingerprint of first resolve">{replay.fingerprintA}</span>
            <span className="badge neutral" title="fingerprint of replayed resolve">{replay.fingerprintB}</span>
            <span className="badge accent" title="runtime version graph hash">graph {replay.runtimeGraphHash}</span>
          </div>
        </Card>
      </section>

      <section>
        <h3 className="const-section-title">Self-hosting · SB-7 reconstructability</h3>
        <p className="const-section-note">
          The defining property of a self-hosting OS: the complete executable state must be reconstructable from
          five canonical sources alone, with no hidden implementation state.
        </p>
        <Card className="const-row">
          <div className="const-item-head">
            <span className={`badge ${reconstruction.reconstructable ? "good" : "bad"}`}>
              {reconstruction.reconstructable ? "reconstructable" : "NOT RECONSTRUCTABLE"}
            </span>
            <h4>state root {reconstruction.stateRootHash}</h4>
            <span className="spacer" />
            <span className={`badge ${reconstruction.replayDeterministic ? "good" : "bad"}`}>
              replay {reconstruction.replayDeterministic ? "deterministic" : "drift"}
            </span>
          </div>
          <div className="const-enforces">
            {reconstruction.sources.map((s) => (
              <span key={s.id} className={`badge ${s.present ? "neutral" : "bad"}`} title={`${s.role} · fp ${s.fingerprint}`}>
                {s.label} ({s.itemCount})
              </span>
            ))}
          </div>
          {reconstruction.hiddenStateRisks.length > 0 && (
            <div className="const-enforces">
              {reconstruction.hiddenStateRisks.map((r, i) => (
                <span key={i} className={`badge ${r.severity === "blocker" ? "bad" : "warn"}`} title={r.detail}>
                  {r.severity === "blocker" ? "blocks" : "advisory"}: {r.subject}
                </span>
              ))}
            </div>
          )}
          <p className="const-derived">
            {blockers.length === 0
              ? "No blocking hidden state — the executable state is fully derivable from the canonical sources."
              : `${blockers.length} blocking risk(s) must be resolved before the platform is fully self-hosting.`}
          </p>
        </Card>
      </section>
    </div>
  );
}

// ── Journal ──────────────────────────────────────────────────────────────────
function kindTone(kind: string): Tone {
  if (kind === "AuthorityDenied") return "bad";
  if (kind.startsWith("Authority") || kind.startsWith("Mutation")) return "good";
  if (kind === "ConformanceValidated" || kind === "DecisionComposed") return "accent";
  return "neutral";
}

function JournalTab({ journal }: { journal: JournalEntry[] }) {
  return (
    <section>
      <h3 className="const-section-title">Execution journal</h3>
      <p className="const-section-note">
        The canonical, append-only event stream — the replay source. Every step of the lifecycle is recorded in
        causal order and can never be altered.
      </p>
      <div className="const-list">
        {journal.map((e) => (
          <Card key={e.entryId} className="const-row">
            <div className="const-item-head">
              <span className={`badge ${kindTone(e.kind)}`}>{e.kind}</span>
              <h4>{e.summary}</h4>
              <span className="spacer" />
              <span className="const-derived">#{e.seq} · {e.actorKind}</span>
            </div>
            <p className="const-derived">
              {e.at}
              {e.snapshotId ? ` · snapshot ${e.snapshotId}` : ""}
              {e.authorityId ? ` · authority ${e.authorityId}` : ""}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
