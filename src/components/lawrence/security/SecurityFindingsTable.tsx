"use client";

// Phase 10 — security findings table. Renders each finding with a severity badge,
// status, masked evidence, and per-open-finding resolve / accept-risk actions.

import type { SecurityFinding } from "@/components/lawrence/hooks/securityTypes";

function severityTone(severity: SecurityFinding["severity"]): string {
  if (severity === "critical" || severity === "high") return "bad";
  if (severity === "medium") return "warn";
  return "neutral";
}

function statusTone(status: SecurityFinding["status"]): string {
  if (status === "resolved") return "good";
  if (status === "accepted_risk") return "good";
  if (status === "in_review") return "warn";
  return "warn";
}

export function SecurityFindingsTable({
  findings,
  pending,
  onResolve,
}: {
  findings: SecurityFinding[];
  pending: boolean;
  onResolve: (
    findingId: string,
    status: "resolved" | "accepted_risk" | "in_review",
  ) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="card">
        <p className="badge good">No findings match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <strong>Findings ({findings.length})</strong>
      <table style={{ width: "100%", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Severity</th>
            <th style={{ textAlign: "left" }}>Title</th>
            <th style={{ textAlign: "left" }}>Type</th>
            <th style={{ textAlign: "left" }}>Object</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th style={{ textAlign: "left" }}>Evidence</th>
            <th style={{ textAlign: "left" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id}>
              <td>
                <span className={`badge ${severityTone(f.severity)}`}>{f.severity}</span>
              </td>
              <td>
                {f.title}
                {f.summary ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {f.summary}
                  </div>
                ) : null}
              </td>
              <td className="muted">{f.findingType}</td>
              <td className="muted">
                {f.objectType ? `${f.objectType}/${f.objectId ?? "—"}` : "—"}
              </td>
              <td>
                <span className={`badge ${statusTone(f.status)}`}>{f.status}</span>
              </td>
              <td>
                {f.evidence.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <pre
                    style={{
                      maxWidth: 240,
                      maxHeight: 120,
                      overflow: "auto",
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(f.evidence, null, 2)}
                  </pre>
                )}
              </td>
              <td>
                {f.status === "open" || f.status === "in_review" ? (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn"
                      disabled={pending}
                      onClick={() => onResolve(f.id, "resolved")}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={pending}
                      onClick={() => onResolve(f.id, "accepted_risk")}
                    >
                      Accept risk
                    </button>
                  </div>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
