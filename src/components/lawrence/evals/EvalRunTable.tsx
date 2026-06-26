"use client";

// Phase 7 — eval run history table. Lists each run's timestamp, score, pass
// state (via RegressionBadge), and links to the run detail page.

import Link from "next/link";
import type { EvalRun } from "@/types/aiops";
import { RegressionBadge } from "./RegressionBadge";

export function EvalRunTable({
  evalSuiteId,
  runs,
}: {
  evalSuiteId: string;
  runs: EvalRun[];
}) {
  return (
    <div className="card">
      <h3>Eval runs</h3>
      {runs.length === 0 ? (
        <p className="muted">No runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Score</th>
              <th>Result</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.createdAt.slice(0, 19).replace("T", " ")}</td>
                <td>{r.score.toFixed(3)}</td>
                <td>
                  <RegressionBadge
                    regressionDetected={r.regressionDetected}
                    passed={r.passed}
                  />
                </td>
                <td>
                  <Link
                    href={`/aiops/evals/${encodeURIComponent(evalSuiteId)}/runs/${encodeURIComponent(r.id)}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
