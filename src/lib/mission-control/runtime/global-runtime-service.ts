// Global Runtime — the tenant-scoped projection behind the Global Runtime Console
// (/mission-control/runtime). Per the Platform Reconciliation Report (Proposal 9),
// the console is a PROJECTION, not new architecture: it READS cross-domain runtime
// state and owns nothing. Individual Enterprise Objects expose their *local*
// runtime; this exposes the *global* runtime for the whole tenant.
//
// Constitutional discipline (Projection Contract):
//   • read-only — never mutates;
//   • honest — every metric is grounded in a real collection, or a section reports
//     "no activity recorded". It fabricates no numbers (no invented cost/latency).
//   • deterministic over its inputs.

import type { ActorContext } from "@/types/platform";
import { db } from "@/lib/lawrence-core/db";
import { liveGovernedExecutionModel } from "@/lib/gx";

/** A single headline figure with the collection that grounds it. */
export interface RuntimeMetric {
  label: string;
  value: number;
  /** Human-readable detail (e.g. "3 running · 1 failed"). */
  detail: string;
  /** The real data source backing this metric. */
  source: string;
  /** Tone for the console (drives the accent only; never invented). */
  tone: "good" | "warn" | "bad" | "neutral";
}

/** A grounded alert derived from a real incident/finding/failed run. */
export interface RuntimeAlert {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
}

export interface GlobalRuntimeSnapshot {
  generatedAt: string;
  /** The nine headline runtime metrics, all grounded. */
  metrics: RuntimeMetric[];
  /** Open alerts and failures, newest-first, grounded in real rows. */
  alerts: RuntimeAlert[];
  /** Governed-execution lifecycle health (RFC-C0-X), process-wide. */
  governed: {
    totalRecorded: number;
    conformant: boolean;
    lawsSatisfied: number;
    lawsTotal: number;
  };
  /** Throughput rate over the actually-observed event window (honest, not faked). */
  throughput: {
    events: number;
    /** Observed window in minutes between first and last event, or null if < 2 events. */
    windowMinutes: number | null;
    /** Events per minute over that real window, or null when no window exists. */
    perMinute: number | null;
  };
  /** Every metric's backing source, for transparency in the UI footer. */
  sources: string[];
}

const ACTIVE_AGENT_RUN = new Set(["queued", "running", "awaiting_review"]);
const ACTIVE_ACTION = new Set(["queued", "running", "awaiting_approval"]);
const ACTIVE_RUN = new Set(["queued", "running"]);

function tone(active: number, failed: number): RuntimeMetric["tone"] {
  if (failed > 0) return "warn";
  if (active > 0) return "good";
  return "neutral";
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

/**
 * Project the whole tenant's live runtime from the real operational database and
 * the governed-execution lifecycle. Pure read; performs no writes.
 */
export async function globalRuntimeSnapshot(
  ctx: ActorContext,
  now: number = Date.now(),
): Promise<GlobalRuntimeSnapshot> {
  const t = ctx.tenantId;

  const [
    agentDefs,
    agentRuns,
    actions,
    missions,
    functionRuns,
    pipelineRuns,
    auditEvents,
    reviewCases,
    approvals,
    aiUsage,
    incidents,
    findings,
  ] = await Promise.all([
    db.agentDefinitions.list(t, (a) => a.status === "active"),
    db.agentRuns.list(t),
    db.actionExecutions.list(t),
    db.missionExecutions.list(t),
    db.functionRuns.list(t),
    db.pipelineRuns.list(t),
    db.auditEvents.list(t),
    db.reviewCases.list(t),
    db.approvalRequests.list(t),
    db.aiUsageEvents.list(t),
    db.runtimeIncidents.list(t, (i) => i.status !== "resolved"),
    db.securityFindings.list(t, (f) => f.status === "open" || f.status === "in_review"),
  ]);

  // ── Agents ──────────────────────────────────────────────────────────────
  const agentsRunning = agentRuns.filter((r) => ACTIVE_AGENT_RUN.has(r.status)).length;
  const agentsFailed = agentRuns.filter((r) => r.status === "failed").length;

  // ── Missions (governed actions + mission executions) ──────────────────────
  const missionsActive = actions.filter((a) => ACTIVE_ACTION.has(a.status)).length;
  const missionsBlocked = actions.filter((a) => a.status === "blocked").length;
  const missionsFailed = actions.filter((a) => a.status === "failed").length;

  // ── Background workflows (functions + pipelines) ──────────────────────────
  const workflowRuns = [...functionRuns, ...pipelineRuns];
  const workflowsRunning = workflowRuns.filter((r) => ACTIVE_RUN.has(r.status)).length;
  const workflowsFailed = workflowRuns.filter((r) => r.status === "failed").length;

  // ── Queues ────────────────────────────────────────────────────────────────
  const reviewOpen = reviewCases.filter(
    (c) => c.status === "open" || c.status === "in_review",
  ).length;
  const approvalsPending = approvals.filter((a) => a.status === "pending").length;

  // ── AI token usage, cost, latency (all real, from aiUsageEvents) ──────────
  const totalTokens = aiUsage.reduce((s, e) => s + (e.totalTokens ?? 0), 0);
  const totalCost = aiUsage.reduce((s, e) => s + (e.estimatedCost ?? 0), 0);
  const latencies = aiUsage
    .map((e) => e.latencyMs)
    .filter((v): v is number => typeof v === "number");
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  // ── Event throughput over the REAL observed window (never faked per-minute) ─
  const eventTimes = auditEvents
    .map((e) => Date.parse(e.createdAt))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let windowMinutes: number | null = null;
  let perMinute: number | null = null;
  if (eventTimes.length >= 2) {
    const first = eventTimes[0]!;
    const last = eventTimes[eventTimes.length - 1]!;
    const mins = (last - first) / 60000;
    windowMinutes = Math.max(1, Math.round(mins));
    perMinute = Math.round((auditEvents.length / windowMinutes) * 10) / 10;
  }

  // ── Governed execution lifecycle (RFC-C0-X) ───────────────────────────────
  const gx = liveGovernedExecutionModel(now);
  const gxSatisfied = gx.findings.filter((f) => f.satisfied).length;

  const metrics: RuntimeMetric[] = [
    {
      label: "Active AI agents",
      value: agentsRunning,
      detail: `${agentDefs.length} defined · ${agentsRunning} running · ${agentsFailed} failed`,
      source: "agent_definitions · agent_runs",
      tone: tone(agentsRunning, agentsFailed),
    },
    {
      label: "Running missions",
      value: missionsActive,
      detail: `${missionsActive} active · ${missionsBlocked} blocked · ${missionsFailed} failed · ${missions.length} mission runs`,
      source: "action_executions · mission_executions",
      tone: missionsFailed > 0 || missionsBlocked > 0 ? "warn" : tone(missionsActive, 0),
    },
    {
      label: "Background workflows",
      value: workflowsRunning,
      detail: `${functionRuns.length} functions · ${pipelineRuns.length} pipelines · ${workflowsFailed} failed`,
      source: "function_runs · pipeline_runs",
      tone: tone(workflowsRunning, workflowsFailed),
    },
    {
      label: "Event throughput",
      value: auditEvents.length,
      detail:
        perMinute !== null
          ? `${perMinute}/min over observed ${windowMinutes}m window`
          : "single sample — rate needs ≥2 events",
      source: "audit_events",
      tone: "neutral",
    },
    {
      label: "Queue health",
      value: reviewOpen + approvalsPending,
      detail: `${reviewOpen} review cases open · ${approvalsPending} approvals pending`,
      source: "review_cases · approval_requests",
      tone: reviewOpen + approvalsPending > 0 ? "warn" : "good",
    },
    {
      label: "Token usage",
      value: totalTokens,
      detail: `${aiUsage.length} model calls · ${totalTokens.toLocaleString()} tokens`,
      source: "ai_usage_events",
      tone: "neutral",
    },
    {
      label: "Estimated cost",
      value: Math.round(totalCost * 100) / 100,
      detail: `$${totalCost.toFixed(2)} across ${aiUsage.length} calls`,
      source: "ai_usage_events",
      tone: "neutral",
    },
    {
      label: "Execution latency",
      value: avgLatency,
      detail:
        latencies.length > 0
          ? `${avgLatency}ms avg · ${p95(latencies)}ms p95 (${latencies.length} samples)`
          : "no latency samples recorded",
      source: "ai_usage_events.latencyMs",
      tone: "neutral",
    },
    {
      label: "Governed executions",
      value: gx.totalRecorded,
      detail: `${gxSatisfied}/${gx.findings.length} constitutional laws satisfied · ${gx.conformant ? "conformant" : "VIOLATION"}`,
      source: "gx execution-record (RFC-C0-X)",
      tone: gx.conformant ? "good" : "bad",
    },
  ];

  const alerts: RuntimeAlert[] = [
    ...incidents.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      source: "runtime_incidents",
    })),
    ...findings.map((f) => ({
      id: f.id,
      title: f.title ?? "Security finding",
      severity: f.severity,
      source: "security_findings",
    })),
  ];

  return {
    generatedAt: new Date(now).toISOString(),
    metrics,
    alerts,
    governed: {
      totalRecorded: gx.totalRecorded,
      conformant: gx.conformant,
      lawsSatisfied: gx.findings.filter((f) => f.satisfied).length,
      lawsTotal: gx.findings.length,
    },
    throughput: { events: auditEvents.length, windowMinutes, perMinute },
    sources: [
      "agent_definitions",
      "agent_runs",
      "action_executions",
      "mission_executions",
      "function_runs",
      "pipeline_runs",
      "audit_events",
      "review_cases",
      "approval_requests",
      "ai_usage_events",
      "runtime_incidents",
      "security_findings",
      "gx execution-record (RFC-C0-X)",
    ],
  };
}
