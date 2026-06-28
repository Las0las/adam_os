// L0 — the Enterprise Constitution surface. A read-only, authoritative view of
// the ratified document every layer obeys: Identity, Mission, Principles, Rights,
// Responsibilities, Invariants, and the Policies derived from them. The document
// is the single source of truth; this page only projects it.

import { PageHeader } from "@/components/lawrence/shared/widgets";
import { getConstitution } from "@/lib/constitution";

export const metadata = {
  title: "Constitution — LAWRENCE",
  description: "The ratified enterprise constitution: identity, mission, principles, rights, responsibilities, and invariants.",
};

export default function ConstitutionPage() {
  const c = getConstitution();

  return (
    <div className="stack">
      <PageHeader
        title="Enterprise Constitution"
        sub={`The foundational layer (L0) every surface obeys · v${c.version}`}
      />

      {/* Identity + Mission */}
      <section className="card const-hero">
        <div className="const-eyebrow">Enterprise Identity</div>
        <h2 className="const-identity-name">{c.identity.name}</h2>
        <p className="const-descriptor">{c.identity.descriptor}</p>
        <div className="const-identity-meta">
          <span className="badge neutral">id: {c.identity.id}</span>
          <span className="badge neutral">jurisdictions: {c.identity.jurisdictions.join(", ")}</span>
          <span className="badge good">ratified v{c.identity.ratifiedVersion}</span>
        </div>
        <div className="const-mission">
          <div className="const-eyebrow">Mission</div>
          <p className="const-mission-statement">{c.mission.statement}</p>
          <ul className="const-measures">
            {c.mission.measures.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Principles */}
      <section>
        <h3 className="const-section-title">Principles</h3>
        <div className="const-grid">
          {c.principles.map((p) => (
            <article className="card const-item" key={p.id}>
              <div className="const-item-head">
                <span className="badge neutral">{p.id}</span>
                <h4>{p.title}</h4>
              </div>
              <p className="muted">{p.statement}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Rights + Responsibilities */}
      <section className="const-two-col">
        <div>
          <h3 className="const-section-title">Rights</h3>
          <div className="const-list">
            {c.rights.map((r) => (
              <article className="card const-row" key={r.id}>
                <div className="const-item-head">
                  <span className="badge neutral">{r.id}</span>
                  <span className="badge good">{r.holder}</span>
                </div>
                <p>{r.statement}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3 className="const-section-title">Responsibilities</h3>
          <div className="const-list">
            {c.responsibilities.map((d) => (
              <article className="card const-row" key={d.id}>
                <div className="const-item-head">
                  <span className="badge neutral">{d.id}</span>
                  <span className="badge warn">{d.bearer}</span>
                </div>
                <p>{d.statement}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Invariants */}
      <section>
        <h3 className="const-section-title">Invariants</h3>
        <p className="const-section-note muted">
          Pure, deterministic rules enforced fail-closed on both the client and the
          server. A blocking invariant that does not hold denies the action.
        </p>
        <div className="const-list">
          {c.invariants.map((inv) => (
            <article className="card const-row" key={inv.id}>
              <div className="const-item-head">
                <span className="badge neutral">{inv.id}</span>
                <h4>{inv.title}</h4>
                <span className={`badge ${inv.severity === "blocking" ? "bad" : "warn"}`}>
                  {inv.severity}
                </span>
                <span className="spacer" />
                <span className="const-derived">derives {inv.derivedFrom.join(" · ")}</span>
              </div>
              <p>{inv.statement}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Policies */}
      <section>
        <h3 className="const-section-title">Policies</h3>
        <div className="const-grid">
          {c.policies.map((pol) => (
            <article className="card const-item" key={pol.id}>
              <div className="const-item-head">
                <span className="badge neutral">{pol.id}</span>
                <h4>{pol.title}</h4>
              </div>
              <p className="muted">{pol.statement}</p>
              <div className="const-enforces">
                {pol.enforces.map((e) => (
                  <span className="badge neutral" key={e}>
                    {e}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
