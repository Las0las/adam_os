// RFC-C0-X · Governed Execution surface. Pure projection — it renders the model
// the page produced by exercising the real lifecycle runtime; it owns no state.

import {
  PHASE_CAPTION,
  type ExecutionPhase,
  type GovernedExecution,
  type GovernedExecutionModel,
  type LawConformance,
  type EvaluationOutcome,
  type RiskBand,
  type ExecutionStatus,
  type StepStatus,
} from "@/lib/gx";

const accent = "var(--accent)";

function statusTone(s: ExecutionStatus): string {
  return s === "completed" ? "good" : s === "denied" ? "bad" : "warn";
}
function outcomeTone(o: EvaluationOutcome): string {
  return o === "success" ? "good" : o === "failure" ? "bad" : "warn";
}
function riskTone(r: RiskBand): string {
  return r === "low" ? "good" : r === "high" ? "bad" : "warn";
}
function stepTone(s: StepStatus): string {
  return s === "succeeded" ? "good" : s === "failed" ? "bad" : "neutral";
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 11, color: "var(--muted)" }}>
      {children}
    </code>
  );
}

// ── Conformance ─────────────────────────────────────────────────────────────

function LawCard({ f }: { f: LawConformance }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mono>{f.law}</Mono>
          <strong style={{ fontSize: 13 }}>{f.title}</strong>
        </span>
        <span className={`badge ${f.satisfied ? "good" : "bad"}`}>{f.satisfied ? "PASS" : "FAIL"}</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        {f.detail}
      </p>
    </div>
  );
}

// ── Lifecycle rail ────────────────────────────────────────────────────────--

function PhaseRail({ lifecycle, completed }: { lifecycle: readonly ExecutionPhase[]; completed: ExecutionPhase[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }}>
      {lifecycle.map((phase, i) => {
        const done = completed.includes(phase);
        return (
          <div
            key={phase}
            style={{
              flex: "1 1 180px",
              minWidth: 160,
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${done ? accent : "var(--border)"}`,
              borderRadius: 8,
              padding: "10px 12px",
              background: "var(--panel)",
              opacity: done ? 1 : 0.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: accent,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong style={{ fontSize: 12, textTransform: "capitalize" }}>{phase}</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.45 }}>
              {PHASE_CAPTION[phase]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Artifact blocks for the worked example ──────────────────────────────────

function Block({ phase, n, title, children }: { phase: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: `1px solid ${accent}`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {n}
        </span>
        <span style={{ flex: 1, width: 1, background: "var(--border)", marginTop: 4 }} aria-hidden />
      </div>
      <div style={{ flex: 1, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 13, textTransform: "capitalize" }}>{phase}</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {title}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

function KV({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 12, padding: "3px 0" }}>
      <span className="muted" style={{ flex: "0 0 132px" }}>
        {k}
      </span>
      <span style={{ flex: 1, color: tone ? `var(--${tone})` : "inherit" }}>{v}</span>
    </div>
  );
}

function WorkedExample({ ex }: { ex: GovernedExecution }) {
  const e = ex.evaluation;
  return (
    <div className="card" style={{ borderColor: accent }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14 }}>Worked example — {ex.objective.statement}</h3>
          <Mono>{ex.executionId}</Mono>
        </div>
        <span className={`badge ${statusTone(ex.status)}`}>{ex.status}</span>
      </div>

      <Block phase="plan" n={1} title="C0-X.1 · objective, strategy, expected outcome">
        <KV k="Objective" v={ex.objective.statement} />
        <KV k="Expected outcome" v={ex.objective.expectedOutcome} />
        <KV
          k="Strategy"
          v={
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ex.plan.strategy.steps.map((s) => (
                <span key={s.id} className="badge neutral" title={s.mode}>
                  {s.label}
                  {s.mutates ? " ·write" : ""}
                </span>
              ))}
            </span>
          }
        />
        <KV k="Plan id" v={<Mono>{ex.plan.planId}</Mono>} />
      </Block>

      <Block phase="govern" n={2} title="C0-X.2 · real execution authority spent">
        <KV k="Authority" v={<Mono>{ex.authorityId ?? "—"}</Mono>} tone={ex.granted ? "good" : "bad"} />
        <KV k="Granted" v={ex.granted ? "yes" : "no — execution halts"} tone={ex.granted ? "good" : "bad"} />
      </Block>

      <Block phase="execute" n={3} title="C0-X · planned steps run under authority">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {ex.stepOutcomes.map((o) => (
            <div key={o.stepId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span className={`badge ${stepTone(o.status)}`}>{o.status}</span>
              <span>{o.label}</span>
              {o.mutated ? <span className="muted" style={{ fontSize: 11 }}>·committed</span> : null}
            </div>
          ))}
        </div>
      </Block>

      <Block phase="observe" n={4} title="C0-X.3 · six dimensions, from the canonical journal">
        <KV k="What" v={ex.observation.what} />
        <KV k="Why" v={ex.observation.why} />
        <KV k="Who" v={`${ex.observation.who.label ?? ex.observation.who.kind} (${ex.observation.who.kind})`} />
        <KV k="Which" v={ex.observation.which.join(", ")} />
        <KV k="When" v={`${ex.observation.when.steps.length} step timestamps`} />
        <KV k="Decisions" v={ex.observation.decisions.join(" ")} />
        <KV k="Journal refs" v={<Mono>seq {ex.observation.journalRefs.join(", ") || "—"}</Mono>} />
      </Block>

      <Block phase="evaluate" n={5} title="C0-X.4 · objective evaluation, permanent">
        <div className="grid grid-4" style={{ gap: 8, marginBottom: 8 }}>
          <Metric label="Outcome" value={e.outcome} tone={outcomeTone(e.outcome)} />
          <Metric label="Quality" value={e.quality.toFixed(2)} />
          <Metric label="Confidence" value={e.confidence.toFixed(2)} />
          <Metric label="Risk" value={e.risk} tone={riskTone(e.risk)} />
        </div>
        <KV k="Evidence coverage" v={`${Math.round(e.evidenceCoverage * 100)}% of 6 dimensions`} />
        <KV k="Policy compliance" v={e.policyCompliance} tone={e.policyCompliance === "compliant" ? "good" : "bad"} />
        <KV
          k="Resources"
          v={`${e.resourceConsumption.steps} steps · ${e.resourceConsumption.mutations} mutations · ${e.resourceConsumption.durationMs}ms`}
        />
      </Block>

      <Block phase="learn" n={6} title="C0-X.6 · signals that inform the future">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ex.learnings.map((l) => (
            <p key={l.id} style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
              <span className="badge accent" style={{ marginRight: 6 }}>
                future
              </span>
              {l.observation}
            </p>
          ))}
        </div>
      </Block>

      <Block phase="optimize" n={7} title="C0-X.6 · a NEW strategy — history is never rewritten">
        {ex.optimizedStrategy ? (
          <>
            <KV k="New strategy" v={<Mono>{ex.optimizedStrategy.id}</Mono>} />
            <KV k="Derived from" v={<Mono>{ex.optimizedStrategy.derivedFrom}</Mono>} />
            <KV
              k="Steps"
              v={`${ex.optimizedStrategy.steps.length} (original strategy kept ${ex.plan.strategy.steps.length}, unchanged)`}
            />
          </>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            No new strategy proposed for this execution.
          </p>
        )}
      </Block>

      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
        <span className="badge neutral">record hash</span>
        <Mono>{ex.recordHash}</Mono>
        <span className="muted" style={{ fontSize: 11 }}>
          · frozen + content-addressed (C0-X.5)
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card metric" style={{ padding: 12 }}>
      <div className="value" style={{ fontSize: 20, color: tone ? `var(--${tone})` : "inherit", textTransform: "capitalize" }}>
        {value}
      </div>
      <div className="label">{label}</div>
    </div>
  );
}

// ── Contrast executions (denied + partial) ───────────────────────────────────

function ContrastCard({ ex, headline }: { ex: GovernedExecution; headline: string }) {
  const e = ex.evaluation;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>{headline}</h3>
        <span className={`badge ${statusTone(ex.status)}`}>{ex.status}</span>
      </div>
      <KV k="Intent" v={<Mono>{ex.intentKind}</Mono>} />
      <KV k="Actor" v={`${ex.actor.label ?? ex.actor.kind} (${ex.actor.kind})`} />
      <KV k="Granted" v={ex.granted ? "yes" : "no"} tone={ex.granted ? "good" : "bad"} />
      <KV k="Steps run" v={String(ex.stepOutcomes.length)} />
      <KV k="Evaluation" v={`${e.outcome} · quality ${e.quality.toFixed(2)} · risk ${e.risk}`} tone={outcomeTone(e.outcome)} />
      <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        {e.rationale}
      </p>
    </div>
  );
}

// ── Surface ─────────────────────────────────────────────────────────────────

export function GovernedExecutionView({ model }: { model: GovernedExecutionModel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Conformance proof — the center of gravity */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Constitutional conformance</h2>
          <span className={`badge ${model.conformant ? "good" : "bad"}`}>
            {model.conformant ? "RFC-C0-X conformant" : "non-conformant"}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            · {model.findings.filter((f) => f.satisfied).length}/{model.findings.length} laws · proven against the live runtime
          </span>
        </div>
        <div className="grid grid-3">
          {model.findings.map((f) => (
            <LawCard key={f.law} f={f} />
          ))}
        </div>
      </section>

      {/* The normative lifecycle */}
      <section>
        <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>
          The lifecycle{" "}
          <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
            · Intent → Plan → Govern → Execute → Observe → Evaluate → Learn → Optimize
          </span>
        </h2>
        <PhaseRail lifecycle={model.lifecycle} completed={model.granted.phasesCompleted} />
      </section>

      {/* One execution, fully worked through all eight phases */}
      <section>
        <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>One governed execution, end to end</h2>
        <WorkedExample ex={model.granted} />
      </section>

      {/* Contrasts: governance halts; learning never rewrites */}
      <section>
        <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>
          The laws under pressure{" "}
          <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
            · {model.totalRecorded} executions in the append-only record
          </span>
        </h2>
        <div className="grid grid-2">
          <ContrastCard
            ex={model.denied}
            headline="C0-X.2 — denied authority halts execution"
          />
          <ContrastCard
            ex={model.failing}
            headline="C0-X.4 / C0-X.6 — a partial run is evaluated and learned from"
          />
        </div>
      </section>
    </div>
  );
}
