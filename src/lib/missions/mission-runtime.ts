// MS-010 — Mission Execution Runtime. The canonical engine that executes a mission
// AFTER governance approval. Generic infrastructure only; deterministic; no AI; no
// write-path changes (it reads governance + emits audit events only).
//
//   Mission → Governance Orchestrator (VS-008, decides) → Mission Runtime (owns
//   execution): plan → resolve deps → schedule (sequential/parallel) → dispatch
//   to registered executors → approval gate → retry → events → state → report.

import { id } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import { evaluateGovernance } from "@/lib/dataops/ontology/governance/governance-orchestrator";
import { GovernanceDecisionError } from "@/lib/dataops/ontology/governance/governance-errors";
import type { GovernanceDecision } from "@/lib/dataops/ontology/governance/governance-types";
import { planMission, MissionPlanError } from "./execution-planner";
import { getExecutor, type TaskExecutionContext } from "./executor-registry";
import { effectiveRetry, runWithRetry } from "./retry-manager";
import { makeMissionEvent, publishMissionEvent } from "./mission-events";
import { persistMissionExecution } from "./mission-execution-store";
import type {
  MissionDefinition,
  MissionExecutionReport,
  MissionEvent,
  TaskExecutionRecord,
  TaskState,
  MissionExecutionState,
  ExecuteMissionOptions,
} from "./mission-types";

// ── Metrics ───────────────────────────────────────────────────────────────────
export interface MissionRuntimeMetrics {
  executions: number;
  completed: number;
  failed: number;
  blocked: number;
  cancelled: number;
  waiting: number;
}
const METRICS: MissionRuntimeMetrics = { executions: 0, completed: 0, failed: 0, blocked: 0, cancelled: 0, waiting: 0 };
export function getMissionRuntimeMetrics(): MissionRuntimeMetrics {
  return { ...METRICS };
}
export function resetMissionRuntimeMetrics(): void {
  METRICS.executions = 0;
  METRICS.completed = 0;
  METRICS.failed = 0;
  METRICS.blocked = 0;
  METRICS.cancelled = 0;
  METRICS.waiting = 0;
}

const TERMINAL_DEP_FAILURE: TaskState[] = ["failed", "skipped", "cancelled"];

function summarize(records: TaskExecutionRecord[]) {
  const count = (s: TaskState) => records.filter((r) => r.state === s).length;
  return {
    total: records.length,
    completed: count("completed"),
    failed: count("failed"),
    skipped: count("skipped"),
    cancelled: count("cancelled"),
    waiting: count("waiting"),
    pending: count("pending"),
    running: count("running"),
  };
}

function buildReport(args: {
  executionId: string;
  mission: MissionDefinition;
  state: MissionExecutionState;
  decision: GovernanceDecision;
  records: TaskExecutionRecord[];
  events: MissionEvent[];
  pendingApprovals: string[];
  startedAtMs: number;
}): MissionExecutionReport {
  const { executionId, mission, state, decision, records, events, pendingApprovals, startedAtMs } = args;
  const totalAttempts = records.reduce((n, r) => n + r.attempts, 0);
  const ranTasks = records.filter((r) => r.attempts > 0).length;
  return {
    executionId,
    missionId: mission.id,
    missionName: mission.name,
    executionState: state,
    governance: {
      executionDecision: decision.executionDecision,
      overallStatus: decision.overallStatus,
      blocking: decision.blockingFindings.length,
      warnings: decision.warningFindings.length,
    },
    tasks: records,
    summary: summarize(records),
    pendingApprovals: [...pendingApprovals].sort(),
    durationMs: Date.now() - startedAtMs,
    retryStatistics: { totalAttempts, totalRetries: totalAttempts - ranTasks },
    events,
    auditExecutionId: executionId,
  };
}

/**
 * Execute a mission. Governance decides whether execution may begin; the runtime
 * owns execution. Returns a typed MissionExecutionReport. The runtime never throws
 * for an expected outcome (governance block, plan error, task failure, pause,
 * cancellation) — those are reported as the corresponding executionState.
 */
export async function executeMission(
  ctx: ActorContext,
  mission: MissionDefinition,
  opts: ExecuteMissionOptions = {},
): Promise<MissionExecutionReport> {
  const executionId = id("mexec");
  const startedAtMs = Date.now();
  const events: MissionEvent[] = [];
  const pendingApprovals: string[] = [];
  const approvals = new Set(opts.approvals instanceof Set ? [...opts.approvals] : (opts.approvals ?? []));
  const isCancelled = () => Boolean(opts.cancelled?.());

  const emit = async (
    type: MissionEvent["type"],
    extra: { taskId?: string; detail?: Record<string, unknown> } = {},
  ) => {
    events.push(await publishMissionEvent(ctx, makeMissionEvent(type, mission.id, executionId, extra)));
  };

  METRICS.executions += 1;

  // ── Stage 0: governance (VS-008) decides whether execution may begin. ───────
  let decision: GovernanceDecision;
  try {
    decision = await evaluateGovernance(ctx, {
      subjectType: "mission",
      subjectId: mission.id,
      objectTypes: mission.objectTypes,
      graph: opts.graph,
      mode: opts.mode,
    });
  } catch (err) {
    if (err instanceof GovernanceDecisionError) decision = err.decision;
    else throw err;
  }

  // Task records start in "pending".
  const records: TaskExecutionRecord[] = mission.tasks.map((t) => ({
    id: t.id,
    executor: t.executor,
    state: "pending",
    dependsOn: [...(t.dependsOn ?? [])],
    attempts: 0,
  }));
  const byId = new Map(records.map((r) => [r.id, r]));
  const taskById = new Map(mission.tasks.map((t) => [t.id, t]));

  // Every exit path produces a durable, observable execution record (MS-011).
  const finalize = async (state: MissionExecutionState): Promise<MissionExecutionReport> => {
    const report = buildReport({ executionId, mission, state, decision, records, events, pendingApprovals, startedAtMs });
    await persistMissionExecution(ctx, report);
    return report;
  };

  if (decision.executionDecision === "BLOCKED") {
    METRICS.blocked += 1;
    await emit("mission.failed", { detail: { reason: "governance_blocked", codes: decision.blockingFindings.map((f) => f.code) } });
    return finalize("blocked");
  }

  // ── Stage 1: plan (Execution Planner + Dependency Resolver + cycle detection).
  let plan;
  try {
    plan = planMission(mission);
  } catch (err) {
    if (err instanceof MissionPlanError) {
      METRICS.failed += 1;
      await emit("mission.failed", { detail: { reason: "plan_error", code: err.code, detail: err.detail } });
      return finalize("failed");
    }
    throw err;
  }

  await emit("mission.started", { detail: { tasks: records.length, layers: plan.layers.length } });

  // ── Stage 2: schedule + dispatch, layer by layer (parallel within a layer). ──
  let paused = false;
  for (const layer of plan.layers) {
    if (isCancelled()) break;

    const layerTasks = layer.map((tid) => byId.get(tid)!); // already sorted by planner
    const toRun: TaskExecutionRecord[] = [];

    for (const rec of layerTasks) {
      if (rec.dependsOn.some((d) => TERMINAL_DEP_FAILURE.includes(byId.get(d)!.state))) {
        rec.state = "skipped";
        continue;
      }
      if (rec.dependsOn.some((d) => byId.get(d)!.state === "waiting" || byId.get(d)!.state === "pending")) {
        rec.state = "pending"; // upstream gate not cleared this run
        continue;
      }
      const def = taskById.get(rec.id)!;
      if (def.requiresApproval && !approvals.has(rec.id)) {
        rec.state = "waiting";
        pendingApprovals.push(rec.id);
        continue;
      }
      rec.state = "ready";
      toRun.push(rec);
    }

    // Deterministic: emit all started events (sorted), run in parallel, then apply
    // results in sorted order.
    for (const rec of toRun) {
      rec.state = "running";
      await emit("mission.task.started", { taskId: rec.id });
    }

    const outcomes = await Promise.all(
      toRun.map(async (rec) => {
        const def = taskById.get(rec.id)!;
        const executor = getExecutor(rec.executor);
        const policy = effectiveRetry(def.retry);
        if (!executor) {
          return { rec, ok: false, attempts: 0, error: `no executor registered: "${rec.executor}"`, output: undefined as Record<string, unknown> | undefined };
        }
        const base: Omit<TaskExecutionContext, "attempt"> = {
          ctx,
          missionId: mission.id,
          executionId,
          taskId: rec.id,
          input: def.input ?? {},
        };
        if (executor.onStart) await executor.onStart({ ...base, attempt: 1 });
        const outcome = await runWithRetry(
          policy.maxAttempts,
          async (attempt) => executor.execute({ ...base, attempt }),
          async (attempt, error) => { if (executor.onError) await executor.onError({ ...base, attempt }, error); },
        );
        if (outcome.ok && executor.onComplete) await executor.onComplete({ ...base, attempt: outcome.attempts }, outcome.result ?? {});
        return { rec, ok: outcome.ok, attempts: outcome.attempts, error: outcome.error?.message, output: outcome.result?.output };
      }),
    );

    for (const o of outcomes.sort((a, b) => a.rec.id.localeCompare(b.rec.id))) {
      o.rec.attempts = o.attempts;
      if (o.ok) {
        o.rec.state = "completed";
        o.rec.output = o.output;
        await emit("mission.task.completed", { taskId: o.rec.id });
      } else {
        o.rec.state = "failed";
        o.rec.error = o.error;
        await emit("mission.task.failed", { taskId: o.rec.id, detail: { error: o.error } });
      }
    }

    if (layerTasks.some((r) => r.state === "waiting")) {
      paused = true;
      break;
    }
  }

  // ── Stage 3: resolve final mission state. ───────────────────────────────────
  if (isCancelled()) {
    for (const rec of records) {
      if (!["completed", "failed", "skipped"].includes(rec.state)) rec.state = "cancelled";
    }
    METRICS.cancelled += 1;
    await emit("mission.cancelled");
    return finalize("cancelled");
  }

  if (paused) {
    METRICS.waiting += 1;
    await emit("mission.paused", { detail: { pendingApprovals: [...pendingApprovals].sort() } });
    return finalize("waiting");
  }

  const anyFailed = records.some((r) => r.state === "failed");
  if (anyFailed) {
    METRICS.failed += 1;
    await emit("mission.failed", { detail: { reason: "task_failure" } });
    return finalize("failed");
  }

  METRICS.completed += 1;
  await emit("mission.completed");
  return finalize("completed");
}
