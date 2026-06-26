"use client";

// Phase 7 — eval case result table. One row per case: case id, status, a compact
// scores summary, and the first error (if any).

import type { EvalCaseResultRecord } from "@/lib/aiops/evals/eval-production-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

function scoreSummary(scores: Record<string, number>): string {
  const entries = Object.entries(scores);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(", ");
}

export function EvalCaseResultTable({
  caseResults,
}: {
  caseResults: EvalCaseResultRecord[];
}) {
  return (
    <div className="card">
      <h3>Case results</h3>
      {caseResults.length === 0 ? (
        <p className="muted">No case results.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Status</th>
              <th>Scores</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {caseResults.map((c) => (
              <tr key={c.id}>
                <td>
                  <code>{c.evalCaseId}</code>
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{scoreSummary(c.scores)}</td>
                <td className={c.errors.length > 0 ? "badge bad" : "muted"}>
                  {c.errors[0] ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
