"use client";

// Phase 9 — production readiness score card. Shows the 0–100 score and a
// prod-ready badge (green when prodReady, red otherwise) with the 85 threshold
// note. The badge respects the service's prodReady flag (score >= 85 and no
// open blockers).

import type { ReadinessReport } from "@/lib/mission-control/readiness/readiness-service";

export function ReadinessScoreCard({ report }: { report: ReadinessReport }) {
  return (
    <div className="card metric">
      <div className="value">{report.score}/100</div>
      <div className="label">Production readiness</div>
      <div className="row" style={{ marginTop: 8 }}>
        <span className={`badge ${report.prodReady ? "good" : "bad"}`}>
          {report.prodReady ? "Production ready" : "Not production ready"}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Production-ready requires a score of at least 85 with no open blockers.
      </p>
      <p className="muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
    </div>
  );
}
