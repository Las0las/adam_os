"use client";

// Phase 7 — regression/pass badge. Red "Regression" when a regression was
// detected, green "Pass" when the run passed, neutral otherwise.

export function RegressionBadge({
  regressionDetected,
  passed,
}: {
  regressionDetected?: boolean;
  passed?: boolean | null;
}) {
  if (regressionDetected) {
    return <span className="badge bad">Regression</span>;
  }
  if (passed) {
    return <span className="badge good">Pass</span>;
  }
  if (passed === false) {
    return <span className="badge bad">Fail</span>;
  }
  return <span className="badge neutral">—</span>;
}
