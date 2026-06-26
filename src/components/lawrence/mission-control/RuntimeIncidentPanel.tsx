"use client";

// Phase 6 — Runtime incident panel. Lists runtime incidents with title,
// severity badge, status, source, and created age.

import type { RuntimeIncident } from "@/types/mission-control";
import { StatusBadge } from "@/components/lawrence/shared/widgets";
import { timeAgo } from "./missionControlFormat";

const SEVERITY_TONE: Record<string, string> = {
  low: "neutral",
  medium: "warn",
  high: "bad",
  critical: "bad",
};

export function RuntimeIncidentPanel({
  incidents,
}: {
  incidents: RuntimeIncident[];
}) {
  return (
    <div className="card">
      <h3>Runtime incidents</h3>
      {incidents.length === 0 ? (
        <p className="muted">No runtime incidents.</p>
      ) : (
        incidents.map((incident) => (
          <div className="card" key={incident.id}>
            <div className="row">
              <span>{incident.title}</span>
              <span className={`badge ${SEVERITY_TONE[incident.severity] ?? "neutral"}`}>
                {incident.severity}
              </span>
            </div>
            <div className="kv">
              <span className="muted">Status</span>
              <StatusBadge status={incident.status} />
            </div>
            <div className="kv">
              <span className="muted">Source</span>
              <span>{incident.source}</span>
            </div>
            <div className="kv">
              <span className="muted">Created</span>
              <span>{timeAgo(incident.createdAt)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
