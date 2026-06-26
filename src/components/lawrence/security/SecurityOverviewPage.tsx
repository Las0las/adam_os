"use client";

// Phase 10 — security posture dashboard client root. Loads the live
// SecurityPosture snapshot and lays out finding counts, audit integrity,
// classification breakdown, and retention + export summaries.

import { useSecurityOverview } from "@/components/lawrence/hooks/useSecurityOverview";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export function SecurityOverviewPage() {
  const { data, loading, error, refresh } = useSecurityOverview();

  return (
    <>
      <PageHeader
        title="Security posture"
        sub="Live security findings, audit integrity, classifications, retention, and exports."
      />

      <div className="card">
        <div className="row">
          <strong>Posture snapshot</strong>
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        {data ? (
          <p className="muted" style={{ marginTop: 8 }}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load posture: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="card">
            <strong>Open findings by severity</strong>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <span className="badge bad">
                Critical {data.findings.bySeverity.critical}
              </span>
              <span className="badge bad">High {data.findings.bySeverity.high}</span>
              <span className="badge warn">
                Medium {data.findings.bySeverity.medium}
              </span>
              <span className="badge">Low {data.findings.bySeverity.low}</span>
              <span className="badge">Open total {data.findings.open}</span>
            </div>
            {data.findings.criticalOpen > 0 ? (
              <p className="badge bad" style={{ marginTop: 8 }}>
                {data.findings.criticalOpen} critical finding(s) open
              </p>
            ) : null}
          </div>

          <div className="card">
            <strong>Audit integrity</strong>
            <div className="row" style={{ marginTop: 8 }}>
              {data.auditIntegrity.lastCheckPassed === null ? (
                <span className="badge">No checks run</span>
              ) : (
                <span
                  className={`badge ${data.auditIntegrity.lastCheckPassed ? "good" : "bad"}`}
                >
                  {data.auditIntegrity.lastCheckPassed
                    ? "Last check passed"
                    : "Last check failed"}
                </span>
              )}
              <span className="muted">{data.auditIntegrity.checks} check(s) total</span>
            </div>
          </div>

          <div className="card">
            <strong>Classifications</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              {data.classifications.total} classified record(s)
            </p>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              {Object.entries(data.classifications.byClassification).map(
                ([key, count]) => (
                  <span className="badge" key={key}>
                    {key} {count}
                  </span>
                ),
              )}
              {Object.keys(data.classifications.byClassification).length === 0 ? (
                <span className="muted">No classifications recorded.</span>
              ) : null}
            </div>
          </div>

          <div className="card">
            <strong>Retention &amp; exports</strong>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <span className="badge">{data.retention.policies} retention policies</span>
              <span className="badge">{data.retention.jobs} retention jobs</span>
              <span className="badge">{data.complianceExports.total} exports</span>
              {data.complianceExports.lastStatus ? (
                <span className="badge">
                  Last export {data.complianceExports.lastStatus}
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
