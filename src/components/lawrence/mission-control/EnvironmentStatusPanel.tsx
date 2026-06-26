"use client";

// Phase 6 — Environment status panel. Table of environments (key, name, type,
// status badge).

import type { Environment } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

export function EnvironmentStatusPanel({
  environments,
}: {
  environments: Environment[];
}) {
  return (
    <div className="card">
      <h3>Environments</h3>
      {environments.length === 0 ? (
        <p className="muted">No environments configured.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {environments.map((env) => (
              <tr key={env.id}>
                <td>{env.key}</td>
                <td>{env.name}</td>
                <td>{env.environmentType}</td>
                <td>
                  <StatusBadge status={env.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
