"use client";

// Phase 7 — observability headline metrics. Eight cards drawn from
// overview.metrics. Optional quality metrics render "—" when undefined; cost is
// formatted as USD and pass/accuracy/groundedness/acceptance as percentages.

import type { ObservabilityOverview } from "@/lib/aiops/observability/observability-types";
import { Metric } from "@/components/lawrence/shared/widgets";

function pct(value: number | undefined): string {
  return value === undefined ? "—" : `${(value * 100).toFixed(0)}%`;
}

export function ObservabilityMetricsRow({
  metrics,
}: {
  metrics: ObservabilityOverview["metrics"];
}) {
  return (
    <div className="grid grid-4">
      <Metric label="Runs (24h)" value={metrics.totalRuns24h} />
      <Metric label="Failed runs (24h)" value={metrics.failedRuns24h} />
      <Metric label="Avg latency (ms)" value={metrics.averageLatencyMs.toFixed(0)} />
      <Metric label="Est. cost (24h)" value={`$${metrics.estimatedCost24h.toFixed(2)}`} />
      <Metric label="Retrieval pass rate" value={pct(metrics.retrievalPassRate)} />
      <Metric label="Extraction accuracy" value={pct(metrics.extractionAccuracy)} />
      <Metric label="Response groundedness" value={pct(metrics.responseGroundedness)} />
      <Metric label="Rec. acceptance" value={pct(metrics.recommendationAcceptanceRate)} />
    </div>
  );
}
