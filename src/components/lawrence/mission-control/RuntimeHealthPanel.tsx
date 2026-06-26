"use client";

// Phase 6 — Runtime health panel. Shows recent health-check counts by status,
// a "Run health checks" button, and a list of the most recent checks.

import type {
  HealthStatus,
  RuntimeHealthCheck,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";
import { timeAgo } from "./missionControlFormat";

const STATUSES: HealthStatus[] = ["healthy", "degraded", "failed", "unknown"];

export function RuntimeHealthPanel({
  healthChecks,
  pending,
  onRun,
}: {
  healthChecks: RuntimeHealthCheck[];
  pending: boolean;
  onRun: () => void;
}) {
  const counts: Record<HealthStatus, number> = {
    healthy: 0,
    degraded: 0,
    failed: 0,
    unknown: 0,
  };
  for (const check of healthChecks) {
    counts[check.status] += 1;
  }

  return (
    <div className="card">
      <div className="row">
        <h3>Runtime health</h3>
        <button type="button" className="btn" disabled={pending} onClick={onRun}>
          Run health checks
        </button>
      </div>

      <div className="btn-row">
        {STATUSES.map((status) => (
          <span key={status}>
            <StatusBadge status={status} /> {counts[status]}
          </span>
        ))}
      </div>

      {healthChecks.length === 0 ? (
        <p className="muted">No recent health checks.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status</th>
              <th>Message</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {healthChecks.map((check) => (
              <tr key={check.id}>
                <td>
                  {check.componentType}:{check.componentKey}
                </td>
                <td>
                  <StatusBadge status={check.status} />
                </td>
                <td>{check.message ?? "—"}</td>
                <td>{timeAgo(check.checkedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
