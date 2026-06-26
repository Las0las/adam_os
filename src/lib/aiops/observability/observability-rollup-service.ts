// Phase 7 — observability rollups. Aggregates traces + usage into hourly/daily
// metric windows for trend reporting. Tenant-scoped, upserted by window key.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ObservabilityRollup } from "./observability-types";

function windowMs(rollupType: "hourly" | "daily"): number {
  return rollupType === "hourly" ? 3_600_000 : 86_400_000;
}

async function buildRollup(
  tenantId: string,
  rollupType: "hourly" | "daily",
  componentType?: string | null,
  componentKey?: string | null,
): Promise<ObservabilityRollup> {
  const refMs = Date.parse(now());
  const startMs = refMs - windowMs(rollupType);
  const inWindow = (ts: string) => {
    const t = Date.parse(ts);
    return !Number.isNaN(t) && t >= startMs && t <= refMs;
  };

  const traces = await db.runtimeTraces.list(tenantId, (t) => {
    if (componentKey && t.componentKey !== componentKey) return false;
    if (componentType && t.componentType !== componentType) return false;
    return inWindow(t.createdAt);
  });
  const usage = await db.aiUsageEvents.list(tenantId, (e) => inWindow(e.createdAt));
  const latencies = usage
    .filter((e) => e.latencyMs != null)
    .map((e) => e.latencyMs as number)
    .sort((a, b) => a - b);
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, x) => s + x, 0) / latencies.length)
    : 0;
  const p95 = latencies.length
    ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]!
    : 0;
  const estimatedCost = usage.reduce((s, e) => s + (e.estimatedCost ?? 0), 0);
  const outcomes = await db.recommendationOutcomes.list(tenantId, (o) => inWindow(o.createdAt));
  const accepted = outcomes.filter((o) => o.decision === "accepted").length;

  const metrics = {
    runCount: traces.length,
    failureCount: traces.filter((t) => t.status === "failed").length,
    averageLatencyMs: avgLatency,
    p95LatencyMs: p95,
    estimatedCost,
    recommendationAcceptanceRate: outcomes.length ? accepted / outcomes.length : 0,
  };

  const windowStart = new Date(startMs).toISOString();
  const existing = await db.observabilityRollups.find(
    tenantId,
    (r) =>
      r.rollupType === rollupType &&
      (r.componentType ?? null) === (componentType ?? null) &&
      (r.componentKey ?? null) === (componentKey ?? null) &&
      r.windowStart === windowStart,
  );
  if (existing) {
    return await db.observabilityRollups.update(existing.id, { metrics, windowEnd: now() });
  }
  return await db.observabilityRollups.insert({
    id: id("rollup"),
    tenantId,
    rollupType,
    componentType: componentType ?? null,
    componentKey: componentKey ?? null,
    windowStart,
    windowEnd: now(),
    metrics,
    createdAt: now(),
  });
}

export async function buildHourlyRollup(
  tenantId: string,
  componentType?: string | null,
  componentKey?: string | null,
): Promise<ObservabilityRollup> {
  return await buildRollup(tenantId, "hourly", componentType, componentKey);
}

export async function buildDailyRollup(
  tenantId: string,
  componentType?: string | null,
  componentKey?: string | null,
): Promise<ObservabilityRollup> {
  return await buildRollup(tenantId, "daily", componentType, componentKey);
}

export async function getRollups(
  tenantId: string,
  filters: { rollupType?: "hourly" | "daily"; componentKey?: string } = {},
): Promise<ObservabilityRollup[]> {
  return (
    await db.observabilityRollups.list(tenantId, (r) => {
      if (filters.rollupType && r.rollupType !== filters.rollupType) return false;
      if (filters.componentKey && r.componentKey !== filters.componentKey) return false;
      return true;
    })
  ).sort((a, b) => b.windowStart.localeCompare(a.windowStart));
}
