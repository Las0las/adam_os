"use client";

// Phase 5 — Command Center production surface (Part B). Client root that loads
// the overview for the active surface mode, applies client-side domain/severity
// filters to each queue, and lays out the three operating columns.

import { useEffect, useMemo, useState } from "react";
import type { CommandCenterItem, SurfaceMode } from "@/lib/domains/command-center/command-center-types";
import { useCommandCenterOverview } from "./useCommandCenterOverview";
import { CommandCenterHeader } from "./CommandCenterHeader";
import { CommandMetricsRow } from "./CommandMetricsRow";
import { CommandQueueColumn } from "./CommandQueueColumn";
import { CommandRecentActivity } from "./CommandRecentActivity";
import { MissionControlRail } from "@/components/lawrence/mission-control/MissionControlRail";
import { readStoredSurfaceMode } from "./SurfaceModeToggle";
import type { CommandFilterValue } from "./CommandFilters";

function applyFilters(items: CommandCenterItem[], filters: CommandFilterValue): CommandCenterItem[] {
  return items.filter((item) => {
    if (filters.domain !== "all" && item.domain !== filters.domain) return false;
    if (filters.severity !== "all" && item.severity !== filters.severity) return false;
    return true;
  });
}

function SkeletonColumn() {
  return (
    <div className="card">
      <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 72 }} />
    </div>
  );
}

export function CommandCenterClient() {
  const [mode, setMode] = useState<SurfaceMode>("executive");
  const [filters, setFilters] = useState<CommandFilterValue>({ domain: "all", severity: "all" });

  // Hydrate the persisted mode after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setMode(readStoredSurfaceMode("executive"));
  }, []);

  const { data, loading, error, refresh } = useCommandCenterOverview(mode);

  const generatedAt = data?.generatedAt ?? "";

  const filtered = useMemo(() => {
    if (!data) return null;
    return {
      actionQueue: applyFilters(data.actionQueue, filters),
      reviewQueue: applyFilters(data.reviewQueue, filters),
      riskQueue: applyFilters(data.riskQueue, filters),
      recommendationQueue: applyFilters(data.recommendationQueue, filters),
      notificationQueue: applyFilters(data.notificationQueue, filters),
      incidentQueue: applyFilters(data.incidentQueue, filters),
    };
  }, [data, filters]);

  return (
    <>
      <CommandCenterHeader
        filters={filters}
        onFiltersChange={setFilters}
        mode={mode}
        onModeChange={setMode}
        onRefresh={refresh}
        loading={loading}
      />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load Command Center: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {data ? <CommandMetricsRow metrics={data.metrics} /> : null}

      {loading && !data ? (
        <div className="cc-grid">
          <div className="cc-col">
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
          <div className="cc-col">
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
          <div className="cc-col">
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
        </div>
      ) : null}

      {filtered ? (
        <div className="cc-grid">
          <div className="cc-col">
            <CommandQueueColumn
              title="Action Queue"
              items={filtered.actionQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
            <CommandQueueColumn
              title="Review Queue"
              items={filtered.reviewQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
          </div>

          <div className="cc-col">
            <CommandQueueColumn
              title="Risk Queue"
              items={filtered.riskQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
            <CommandQueueColumn
              title="Recommendation Queue"
              items={filtered.recommendationQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
          </div>

          <div className="cc-col">
            <CommandQueueColumn
              title="Notifications"
              items={filtered.notificationQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
            <CommandQueueColumn
              title="Incidents"
              items={filtered.incidentQueue}
              generatedAt={generatedAt}
              onSettled={refresh}
            />
            <CommandRecentActivity items={data?.recentActivity ?? []} generatedAt={generatedAt} />
            <MissionControlRail />
          </div>
        </div>
      ) : null}
    </>
  );
}
