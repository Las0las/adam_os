"use client";

import { useState } from "react";
import {
  CONSTITUTION_LENSES,
  type ConstitutionLens,
  type ConstitutionHeadline,
  type ConstitutionView,
  type DecisionSummary,
} from "@/lib/constitution";
import type { AuthoritySummary, JournalEntry } from "@/lib/kernel";
import type { ReplayProof } from "@/lib/projection-runtime";

interface Props {
  constitution: ConstitutionView;
  headline: ConstitutionHeadline;
  decisions: DecisionSummary[];
  authorities: AuthoritySummary[];
  journal: JournalEntry[];
  replay: ReplayProof;
}

export function ConstitutionLenses({ constitution: c, headline, decisions, authorities, journal, replay }: Props) {
  const [lens, setLens] = useState<ConstitutionLens>("document");

  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Constitution lens">
        {CONSTITUTION_LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lens === l.id}
            className={lens === l.id ? "active" : ""}
            onClick={() => setLens(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        {CONSTITUTION_LENSES.find((l) => l.id === lens)?.blurb}
      </p>

      {lens === "document" && <DocumentLens c={c} />}
      {lens === "executive" && <ExecutiveLens c={c} headline={headline} />}
      {lens === "developer" && <DeveloperLens c={c} />}
      {lens === "audit" && (
        <AuditLens c={c} decisions={decisions} authorities={authorities} journal={journal} replay={replay} />
      )}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className ?? ""}`}>{children}</div>;
}

// ── Document lens ────────────────────────────────────────────────────────────
function DocumentLens({ c }: { c: ConstitutionView }) {
  return (
    <div className="stack">
      <Card className="const-hero">
        <div className="const-eyebrow">Enterprise Identity · v{c.version}</div>
        <h2 className="const-identity-name">{c.identity.name}</h2>
        <p className="const-descriptor">{c.identity.descriptor}</p>
        <div className="const-identity-meta">
          {c.identity.jurisdictions.map((j) => (
            <span key={j} className="badge neutral">{j}</span>
          ))}
        </div>
        <div className="const-mission">
          <div className="const-eyebrow">Mission</div>
          <p className="const-mission-statement">{c.mission.statement}</p>
          <ul className="const-measures">
            {c.mission.measures.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </Card>

      <section>
        <h3 className="const-section-title">Principles</h3>
        <p className="const-section-note">The beliefs that shape interpretation of every rule.</p>
        <div className="const-grid">
          {c.principles.map((p) => (
            <Card key={p.id} className="const-item">
              <div className="const-item-head">
                <span className="badge accent">{p.id}</span>
                <h4>{p.title}</h4>
              </div>
              <p>{p.statement}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="const-two-col">
        <section>
          <h3 className="const-section-title">Rights</h3>
          <p className="const-section-note">What actors may expect from the enterprise.</p>
          <div className="const-list">
            {c.rights.map((r) => (
              <Card key={r.id} className="const-row">
                <div className="const-item-head">
                  <span className="badge neutral">{r.id}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{r.holder}</span>
                </div>
                <p>{r.statement}</p>
              </Card>
            ))}
          </div>
        </section>
        <section>
          <h3 className="const-section-title">Responsibilities</h3>
          <p className="const-section-note">What actors owe in return.</p>
          <div className="const-list">
            {c.responsibilities.map((r) => (
              <Card key={r.id} className="const-row">
                <div className="const-item-head">
                  <span className="badge neutral">{r.id}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{r.bearer}</span>
                </div>
                <p>{r.statement}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Executive lens ───────────────────────────────────────────────────────────
function ExecutiveLens({ c, headline }: { c: ConstitutionView; headline: ConstitutionHeadline }) {
  const tiles: { label: string; value: number }[] = [
    { label: "Mission objectives", value: headline.objectives },
    { label: "Principles", value: headline.principles },
    { label: "Blocking invariants", value: headline.blockingInvariants },
    { label: "Executable policies", value: headline.policies },
  ];
  return (
    <div className="stack">
      <div className="const-grid">
        {tiles.map((t) => (
          <Card key={t.label} className="const-item">
            <div className="const-metric-value">{t.value}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t.label}</div>
          </Card>
        ))}
      </div>
      <section>
        <h3 className="const-section-title">Mission objectives</h3>
        <p className="const-section-note">Highest priority first — the runtime aligns actions to these.</p>
        <div className="const-list">
          {[...c.mission.objectives].sort((a, b) => a.priority - b.priority).map((o) => (
            <Card key={o.id} className="const-row">
              <div className="const-item-head">
                <span className="badge accent">P{o.priority}</span>
                <h4>{o.title}</h4>
              </div>
              <p>{o.statement}</p>
              <p className="const-derived">Success metric — {o.successMetric}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Developer lens ───────────────────────────────────────────────────────────
function DeveloperLens({ c }: { c: ConstitutionView }) {
  return (
    <div className="stack">
      <section>
        <h3 className="const-section-title">Invariants</h3>
        <p className="const-section-note">Pure predicates enforced on every governed action — fail-closed.</p>
        <div className="const-list">
          {c.invariants.map((i) => (
            <Card key={i.id} className="const-row">
              <div className="const-item-head">
                <span className="badge accent">{i.id}</span>
                <h4>{i.title}</h4>
                <span className="spacer" />
                <span className={`badge ${i.severity === "blocking" ? "bad" : "warn"}`}>{i.severity}</span>
              </div>
              <p>{i.statement}</p>
              <div className="const-enforces">
                {i.derivedFrom.map((d) => <span key={d} className="badge neutral">derives {d}</span>)}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h3 className="const-section-title">Executable policies</h3>
        <p className="const-section-note">Self-evaluating, self-explaining objects — not text.</p>
        <div className="const-list">
          {c.policies.map((p) => (
            <Card key={p.id} className="const-row">
              <div className="const-item-head">
                <span className="badge accent">{p.id}</span>
                <h4>{p.title}</h4>
              </div>
              <p>{p.statement}</p>
              <div className="const-enforces">
                {p.enforces.map((e) => <span key={e} className="badge neutral">enforces {e}</span>)}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Audit lens ───────────────────────────────────────────────────────────────
function AuditLens({
  c,
  decisions,
  authorities,
  journal,
  replay,
}: {
  c: ConstitutionView;
  decisions: DecisionSummary[];
  authorities: AuthoritySummary[];
  journal: JournalEntry[];
  replay: ReplayProof;
}) {
  return (
    <div className="stack">
      <section>
        <h3 className="const-section-title">Execution authority</h3>
        <p className="const-section-note">
          Every actor — human or AI — submits an intent to the kernel, which issues a signed, expiring
          ExecutionAuthority. AI never executes; it requests authority through this same path.
        </p>
        <div className="const-list">
          {authorities.map((a) => (
            <Card key={a.authorityId} className="const-row">
              <div className="const-item-head">
                <span className={`badge ${a.granted ? "good" : "bad"}`}>
                  {a.granted ? "granted" : "denied"}
                </span>
                <h4>{a.scenario}</h4>
                <span className="spacer" />
                <span className="const-derived">{a.actorKind}</span>
              </div>
              <div className="const-enforces">
                <span className="badge neutral" title="authority id">{a.authorityId}</span>
                <span className="badge neutral" title="tamper-evident signature">{a.signature}</span>
                {a.mission && <span className="badge accent" title="mission objective served">{a.mission}</span>}
              </div>
              {a.capabilities.length > 0 && (
                <div className="const-enforces">
                  {a.capabilities.map((cap) => (
                    <span key={cap} className="badge accent">grants {cap}</span>
                  ))}
                </div>
              )}
              {a.restrictions.length > 0 && (
                <div className="const-enforces">
                  {a.restrictions.map((r) => (
                    <span key={r} className="badge warn">{r}</span>
                  ))}
                </div>
              )}
              {a.granted && (
                <p className="const-derived">Expires {a.expiresAt} · decision {a.decisionId}</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="const-section-title">Execution ledger</h3>
        <p className="const-section-note">
          The append-only operational history. Every governed behavior — authority granted/denied, projection
          rendered, mutation committed — is recorded here and can never be altered.
        </p>
        <div className="const-list">
          {ledger.map((e) => (
            <Card key={e.entryId} className="const-row">
              <div className="const-item-head">
                <span className={`badge ${e.kind.endsWith("denied") ? "bad" : "neutral"}`}>{e.kind}</span>
                <h4>{e.summary}</h4>
                <span className="spacer" />
                <span className="const-derived">#{e.seq} · {e.actorKind}</span>
              </div>
              <p className="const-derived">
                {e.at}
                {e.authorityId ? ` · authority ${e.authorityId}` : ""}
                {e.decisionId ? ` · decision ${e.decisionId}` : ""}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="const-section-title">Version lineage</h3>
        <div className="const-list">
          {c.amendments.map((a) => (
            <Card key={a.version} className="const-row">
              <div className="const-item-head">
                <span className="badge accent">v{a.version}</span>
                <span className="muted" style={{ fontSize: 11 }}>{a.effectiveDate}</span>
                <span className="spacer" />
                <span className="const-derived">{a.supersedes ? `supersedes v${a.supersedes}` : "genesis ratification"}</span>
              </div>
              <p>{a.summary}</p>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h3 className="const-section-title">Live decisions</h3>
        <p className="const-section-note">
          Each row is the real root runtime evaluating a representative action — with the evidence behind the outcome.
        </p>
        <div className="const-list">
          {decisions.map((d) => (
            <Card key={d.decisionId} className="const-row">
              <div className="const-item-head">
                <span className={`badge ${d.authorized ? "good" : "bad"}`}>
                  {d.authorized ? "authorized" : "denied"}
                </span>
                <h4>{d.scenario}</h4>
                <span className="spacer" />
                <span className="const-derived">{d.actorKind} · {d.actionKind}</span>
              </div>
              {d.missionObjective && <p className="const-derived">Serves — {d.missionObjective}</p>}
              {d.violations.length > 0 && (
                <div className="const-enforces">
                  {d.violations.map((v) => (
                    <span key={v.ref} className="badge bad" title={v.rationale}>{v.ref}</span>
                  ))}
                </div>
              )}
              <details className="const-evidence">
                <summary className="const-derived">
                  Evidence · {d.evidence.filter((e) => e.supports).length}/{d.evidence.length} supporting · {d.evaluatedTotal} elements evaluated
                </summary>
                <ul className="const-evidence-list">
                  {d.evidence.map((e, idx) => (
                    <li key={`${e.ref}-${idx}`} className={e.supports ? "ev-ok" : "ev-no"}>
                      <span className="badge neutral">{e.kind}</span> {e.observation}
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
