"use client";

// Phase 9 — production readiness checklist. Renders every ReadinessCheck with a
// pass/fail icon, label, detail, and severity.

import type { ReadinessCheck } from "@/lib/mission-control/readiness/readiness-service";

export function ReadinessChecklist({ checks }: { checks: ReadinessCheck[] }) {
  return (
    <div className="card">
      <strong>Checklist</strong>
      <table style={{ width: "100%", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", width: 32 }} aria-label="result" />
            <th style={{ textAlign: "left" }}>Check</th>
            <th style={{ textAlign: "left" }}>Detail</th>
            <th style={{ textAlign: "left" }}>Severity</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.key}>
              <td>
                <span
                  className={`badge ${check.passed ? "good" : check.severity === "blocker" ? "bad" : "warn"}`}
                  aria-label={check.passed ? "passed" : "failed"}
                >
                  {check.passed ? "✓" : "✕"}
                </span>
              </td>
              <td>{check.label}</td>
              <td className="muted">{check.detail}</td>
              <td>{check.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
