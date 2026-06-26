"use client";

// Phase 6 — Runtime component table. Lists runtime components with type, key,
// status badge, version, and last health status.

import type { RuntimeComponent } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

export function RuntimeComponentTable({
  components,
}: {
  components: RuntimeComponent[];
}) {
  return (
    <div className="card">
      <h3>Runtime components</h3>
      {components.length === 0 ? (
        <p className="muted">No runtime components.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Key</th>
              <th>Status</th>
              <th>Version</th>
              <th>Last health</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id}>
                <td>{component.componentType}</td>
                <td>{component.componentKey}</td>
                <td>
                  <StatusBadge status={component.status} />
                </td>
                <td>{component.version ?? "—"}</td>
                <td>
                  {component.lastHealthStatus ? (
                    <StatusBadge status={component.lastHealthStatus} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
