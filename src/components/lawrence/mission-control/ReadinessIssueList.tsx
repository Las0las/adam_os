"use client";

// Phase 9 — production readiness blockers list. Lists the open blocker checks
// that must be resolved before the tenant can be marked production-ready.
// Empty-state shows "no blockers".

import type { ReadinessCheck } from "@/lib/mission-control/readiness/readiness-service";

export function ReadinessIssueList({ blockers }: { blockers: ReadinessCheck[] }) {
  return (
    <div className="card">
      <strong>Blockers</strong>
      {blockers.length === 0 ? (
        <p className="badge good" style={{ marginTop: 8 }}>
          No blockers — all required checks pass.
        </p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {blockers.map((b) => (
            <li key={b.key}>
              <span className="badge bad">{b.label}</span> <span className="muted">{b.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
