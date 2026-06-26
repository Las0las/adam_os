"use client";

// Phase 6 — Release bundle table. Lists release bundles with per-status actions
// (Submit / Promote / Rollback / View). Resolves targetEnvironmentId to an
// environment key via the passed environments list.

import type {
  Environment,
  ReleaseBundle,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";
import { timeAgo } from "./missionControlFormat";

export function ReleaseBundleTable({
  releases,
  environments,
  pending,
  onSubmit,
  onPromote,
  onRollback,
  onView,
}: {
  releases: ReleaseBundle[];
  environments: Environment[];
  pending: boolean;
  onSubmit: (releaseId: string) => void;
  onPromote: (releaseId: string) => void;
  onRollback: (releaseId: string) => void;
  onView: (releaseId: string) => void;
}) {
  const envKey = (id: string | null | undefined): string => {
    if (!id) return "—";
    const env = environments.find((e) => e.id === id);
    return env ? env.key : id;
  };

  return (
    <div className="card">
      <h3>Release bundles</h3>
      {releases.length === 0 ? (
        <p className="muted">No release bundles.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Target</th>
              <th>Status</th>
              <th>Items</th>
              <th>Created by</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => {
              const canSubmit = release.status === "draft";
              const canPromote = release.status === "approved";
              const canRollback = release.status === "promoted";
              return (
                <tr key={release.id}>
                  <td>{release.name}</td>
                  <td>{release.releaseType}</td>
                  <td>{envKey(release.targetEnvironmentId)}</td>
                  <td>
                    <StatusBadge status={release.status} />
                  </td>
                  <td>—</td>
                  <td>{release.createdBy ?? "—"}</td>
                  <td>{timeAgo(release.createdAt)}</td>
                  <td>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn"
                        disabled={pending || !canSubmit}
                        onClick={() => onSubmit(release.id)}
                      >
                        Submit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={pending || !canPromote}
                        onClick={() => onPromote(release.id)}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={pending || !canRollback}
                        onClick={() => onRollback(release.id)}
                      >
                        Rollback
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => onView(release.id)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
