"use client";

// Phase 9 — sync run history table. Lists IntegrationSyncRun rows with type,
// status, records read/written, created time, and any error message.

import type { IntegrationSyncRun, SyncStatus } from "@/lib/integrations/integration-types";

const STATUS_TONE: Record<SyncStatus, string> = {
  completed: "good",
  running: "warn",
  queued: "neutral",
  degraded: "warn",
  failed: "bad",
};

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return <span className={`badge ${STATUS_TONE[status] ?? "neutral"}`}>{status}</span>;
}

export function IntegrationSyncHistory({ runs }: { runs: IntegrationSyncRun[] }) {
  return (
    <div className="card">
      <strong>Sync history</strong>
      {runs.length === 0 ? (
        <p className="muted">No sync runs yet.</p>
      ) : (
        <table style={{ width: "100%", marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Type</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "right" }}>Read</th>
              <th style={{ textAlign: "right" }}>Written</th>
              <th style={{ textAlign: "left" }}>Created</th>
              <th style={{ textAlign: "left" }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.syncType}</td>
                <td>
                  <SyncStatusBadge status={run.status} />
                </td>
                <td style={{ textAlign: "right" }}>{run.recordsRead}</td>
                <td style={{ textAlign: "right" }}>{run.recordsWritten}</td>
                <td>{new Date(run.createdAt).toLocaleString()}</td>
                <td>{run.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
