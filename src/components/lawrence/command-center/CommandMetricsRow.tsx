import type { CommandCenterOverview } from "@/lib/domains/command-center/command-center-types";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function CommandMetricsRow({ metrics }: { metrics: CommandCenterOverview["metrics"] }) {
  return (
    <div className="cc-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
      <MetricCard label="Open Actions" value={metrics.openActions} />
      <MetricCard label="Open Reviews" value={metrics.openReviews} />
      <MetricCard label="Critical Risks" value={metrics.criticalRisks} />
      <MetricCard label="Blocked Work" value={metrics.blockedWork} />
      <MetricCard label="Pending Approvals" value={metrics.pendingApprovals} />
      <MetricCard label="Runtime Failures" value={metrics.failedRuntimeItems} />
    </div>
  );
}
