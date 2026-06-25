"use client";

import type { SurfaceMode } from "@/lib/domains/command-center/command-center-types";
import { CommandFilters, type CommandFilterValue } from "./CommandFilters";
import { SurfaceModeToggle } from "./SurfaceModeToggle";

export function CommandCenterHeader({
  filters,
  onFiltersChange,
  mode,
  onModeChange,
  onRefresh,
  loading,
}: {
  filters: CommandFilterValue;
  onFiltersChange: (next: CommandFilterValue) => void;
  mode: SurfaceMode;
  onModeChange: (next: SurfaceMode) => void;
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <div className="cc-toolbar">
      <div>
        <div className="page-title">Command Center</div>
        <div className="muted">
          Governed operating surface for actions, reviews, risks, and recommendations.
        </div>
      </div>
      <div className="spacer" />
      <CommandFilters value={filters} onChange={onFiltersChange} />
      <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      <SurfaceModeToggle mode={mode} onChange={onModeChange} />
    </div>
  );
}
