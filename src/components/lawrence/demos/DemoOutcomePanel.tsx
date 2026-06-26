"use client";

// Phase 8 — outcome panel for the selected/last demo step. Shows the declared
// expectedOutcome plus the REAL produced artifacts (object/run ids etc.) and any
// error pulled straight from the run trace — never fabricated.

import type {
  DemoStep,
  DemoRunStepResult,
} from "@/lib/domain-packs/domain-pack-types";

function renderProducedValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function DemoOutcomePanel({
  step,
  result,
}: {
  step: DemoStep | null;
  result: DemoRunStepResult | null;
}) {
  return (
    <div className="card">
      <h3>Outcome</h3>

      {step ? (
        <>
          <p className="muted">Expected</p>
          <p>{step.expectedOutcome}</p>
        </>
      ) : (
        <p className="muted">Select a step to view its outcome.</p>
      )}

      {result ? (
        <>
          <div className="row" style={{ marginTop: 12 }}>
            <span>Status</span>
            <span
              className={`badge ${
                result.status === "completed"
                  ? "good"
                  : result.status === "failed"
                    ? "bad"
                    : "warn"
              }`}
            >
              {result.status}
            </span>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Actual
          </p>
          <p>{result.outcome}</p>

          <h4 style={{ marginTop: 12 }}>Produced artifacts</h4>
          {Object.keys(result.produced).length === 0 ? (
            <p className="muted">No artifacts produced.</p>
          ) : (
            <ul>
              {Object.entries(result.produced).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {renderProducedValue(value)}
                </li>
              ))}
            </ul>
          )}

          {result.error ? (
            <p className="badge bad" style={{ marginTop: 8 }}>
              {result.error}
            </p>
          ) : null}
        </>
      ) : step ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Not run yet.
        </p>
      ) : null}
    </div>
  );
}
