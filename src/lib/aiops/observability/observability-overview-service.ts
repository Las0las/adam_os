// Phase 7 — observability overview. Live cost/latency/failure/quality metrics
// plus top failing + costly + slow runs and open learning signals.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { getCostSummary, getLatencySummary } from "./ai-usage-service";
import type { ActorContext } from "@/types/platform";
import type {
  ComponentMetrics,
  ObservabilityOverview,
  RuntimeTrace,
} from "./observability-types";

function within(ts: string, hours: number, refMs: number): boolean {
  const t = Date.parse(ts);
  return !Number.isNaN(t) && refMs - t <= hours * 3_600_000;
}

function numMetric(t: RuntimeTrace, key: string): number {
  const v = t.metrics[key];
  return typeof v === "number" ? v : 0;
}

function avgEvalScore(runs: { suiteType: string; score: number }[], suiteType: string): number | undefined {
  const matching = runs.filter((r) => r.suiteType === suiteType);
  if (!matching.length) return undefined;
  return matching.reduce((s, r) => s + r.score, 0) / matching.length;
}

export async function getObservabilityOverview(
  ctx: ActorContext,
): Promise<ObservabilityOverview> {
  const generatedAt = now();
  const refMs = Date.parse(generatedAt);

  const [traces, evalRuns, outcomes, learningSignals] = await Promise.all([
    db.runtimeTraces.list(ctx.tenantId),
    db.evalRuns.list(ctx.tenantId),
    db.recommendationOutcomes.list(ctx.tenantId),
    db.learningSignals.list(ctx.tenantId, (s) => s.status === "open"),
  ]);

  const traces24 = traces.filter((t) => within(t.createdAt, 24, refMs));
  const cost = await getCostSummary(ctx.tenantId, 24);
  const latency = await getLatencySummary(ctx.tenantId, 24);

  // Quality metrics from eval runs + recommendation outcomes.
  const acceptance = outcomes.length
    ? outcomes.filter((o) => o.decision === "accepted").length / outcomes.length
    : undefined;

  // Per-component aggregation, with cost joined via ai_usage runId.
  const usage = await db.aiUsageEvents.list(ctx.tenantId);
  const costByRunId = new Map<string, number>();
  for (const e of usage) costByRunId.set(e.runId, (costByRunId.get(e.runId) ?? 0) + (e.estimatedCost ?? 0));

  const compMap = new Map<string, ComponentMetrics & { _latencySum: number; _latencyN: number }>();
  for (const t of traces24) {
    if (!t.componentType || !t.componentKey) continue;
    const key = `${t.componentType}:${t.componentKey}`;
    const m =
      compMap.get(key) ??
      ({
        componentType: t.componentType,
        componentKey: t.componentKey,
        runs: 0,
        failures: 0,
        averageLatencyMs: 0,
        estimatedCost: 0,
        _latencySum: 0,
        _latencyN: 0,
      } as ComponentMetrics & { _latencySum: number; _latencyN: number });
    m.runs += 1;
    if (t.status === "failed") m.failures += 1;
    const lat = numMetric(t, "latencyMs") || numMetric(t, "durationMs");
    if (lat) {
      m._latencySum += lat;
      m._latencyN += 1;
    }
    m.estimatedCost += costByRunId.get(t.traceId) ?? 0;
    compMap.set(key, m);
  }
  const byComponent: ComponentMetrics[] = [...compMap.values()]
    .map((m) => ({
      componentType: m.componentType,
      componentKey: m.componentKey,
      runs: m.runs,
      failures: m.failures,
      averageLatencyMs: m._latencyN ? Math.round(m._latencySum / m._latencyN) : 0,
      estimatedCost: m.estimatedCost,
    }))
    .sort((a, b) => b.runs - a.runs);

  const recentFailures = traces
    .filter((t) => t.status === "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const slowRuns = [...traces24]
    .sort((a, b) => (numMetric(b, "latencyMs") || numMetric(b, "durationMs")) - (numMetric(a, "latencyMs") || numMetric(a, "durationMs")))
    .slice(0, 10);

  const costlyRuns = [...usage]
    .filter((e) => within(e.createdAt, 24, refMs))
    .sort((a, b) => (b.estimatedCost ?? 0) - (a.estimatedCost ?? 0))
    .slice(0, 10);

  return {
    generatedAt,
    metrics: {
      totalRuns24h: traces24.length,
      failedRuns24h: traces24.filter((t) => t.status === "failed").length,
      averageLatencyMs: latency.averageMs,
      estimatedCost24h: cost.estimatedCost,
      retrievalPassRate: avgEvalScore(evalRuns, "retrieval"),
      extractionAccuracy: avgEvalScore(evalRuns, "extraction"),
      responseGroundedness: avgEvalScore(evalRuns, "response"),
      recommendationAcceptanceRate: acceptance,
    },
    byComponent,
    recentFailures,
    costlyRuns,
    slowRuns,
    learningSignals: learningSignals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
