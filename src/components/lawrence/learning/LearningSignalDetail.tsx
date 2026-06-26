"use client";

// Phase 7 — learning signal detail. Renders the selected signal's evidence,
// recommended change, status, and linked artifacts. Read-only; mutation lives in
// LearningSignalActions.

import type { LearningSignal } from "@/lib/aiops/learning/learning-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

export function LearningSignalDetail({
  signal,
}: {
  signal: LearningSignal | null;
}) {
  if (!signal) {
    return (
      <div className="card">
        <p className="muted">Select a signal to review its evidence.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row">
        <h3>{signal.summary}</h3>
        <StatusBadge status={signal.status} />
      </div>

      <div className="row">
        <span>Type</span>
        <span className="badge neutral">{signal.signalType}</span>
      </div>
      <div className="row">
        <span>Severity</span>
        <span
          className={`badge ${signal.severity === "critical" || signal.severity === "high" ? "bad" : "warn"}`}
        >
          {signal.severity}
        </span>
      </div>
      <div className="row">
        <span>Component</span>
        <code>
          {signal.componentType ?? "—"}
          {signal.componentKey ? `:${signal.componentKey}` : ""}
        </code>
      </div>
      {signal.domain ? (
        <div className="row">
          <span>Domain</span>
          <span>{signal.domain}</span>
        </div>
      ) : null}

      <h4 style={{ marginTop: 12 }}>Evidence</h4>
      {signal.evidence.length === 0 ? (
        <p className="muted">No evidence attached.</p>
      ) : (
        <ul>
          {signal.evidence.map((e, i) => (
            <li key={i}>
              <code>{JSON.stringify(e)}</code>
            </li>
          ))}
        </ul>
      )}

      <h4 style={{ marginTop: 12 }}>Recommended change</h4>
      <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
        <code>{JSON.stringify(signal.recommendedChange, null, 2)}</code>
      </pre>

      <h4 style={{ marginTop: 12 }}>Links</h4>
      <div className="row">
        <span>From feedback</span>
        <code>{signal.createdFromFeedbackId ?? "—"}</code>
      </div>
      <div className="row">
        <span>From eval run</span>
        <code>{signal.createdFromEvalRunId ?? "—"}</code>
      </div>
      <div className="row">
        <span>Release bundle</span>
        <code>{signal.linkedReleaseBundleId ?? "—"}</code>
      </div>
    </div>
  );
}
