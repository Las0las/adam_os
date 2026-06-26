"use client";

// Phase 6 — Mission audit timeline. Derives a "Recent runtime activity" feed by
// merging recent health checks, runtime incidents, and active kill switches into
// a single time-sorted list. No new API call — purely derived from the overview.

import type {
  KillSwitch,
  RuntimeHealthCheck,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { RuntimeIncident } from "@/types/mission-control";
import { epochOf, timeAgo } from "./missionControlFormat";

interface TimelineEntry {
  id: string;
  label: string;
  tone: string;
  at: string | null;
  sortKey: number;
}

export function MissionAuditTimeline({
  healthChecks,
  incidents,
  killSwitches,
}: {
  healthChecks: RuntimeHealthCheck[];
  incidents: RuntimeIncident[];
  killSwitches: KillSwitch[];
}) {
  const entries: TimelineEntry[] = [];

  for (const check of healthChecks) {
    entries.push({
      id: `health-${check.id}`,
      label: `Health check ${check.componentType}:${check.componentKey} — ${check.status}`,
      tone:
        check.status === "failed"
          ? "bad"
          : check.status === "degraded"
            ? "warn"
            : check.status === "healthy"
              ? "good"
              : "neutral",
      at: check.checkedAt,
      sortKey: epochOf(check.checkedAt),
    });
  }

  for (const incident of incidents) {
    entries.push({
      id: `incident-${incident.id}`,
      label: `Incident: ${incident.title} (${incident.severity})`,
      tone: incident.severity === "low" ? "neutral" : "bad",
      at: incident.createdAt,
      sortKey: epochOf(incident.createdAt),
    });
  }

  for (const ks of killSwitches) {
    entries.push({
      id: `killswitch-${ks.id}`,
      label: `Kill switch enabled ${ks.componentType}:${ks.componentKey}`,
      tone: "bad",
      at: ks.enabledAt ?? ks.createdAt,
      sortKey: epochOf(ks.enabledAt ?? ks.createdAt),
    });
  }

  entries.sort((a, b) => b.sortKey - a.sortKey);

  return (
    <div className="card">
      <h3>Recent runtime activity</h3>
      {entries.length === 0 ? (
        <p className="muted">No recent activity.</p>
      ) : (
        entries.map((entry) => (
          <div className="row" key={entry.id}>
            <span className={`badge ${entry.tone}`}>{entry.label}</span>
            <span className="muted">{timeAgo(entry.at)}</span>
          </div>
        ))
      )}
    </div>
  );
}
