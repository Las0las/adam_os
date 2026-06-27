// MS-011 — Governed Action Executor + durable Mission Executions. The action
// executor bridges a mission task to the Mission Control action engine
// (executeAction), inheriting its governed pipeline; every execution is persisted
// as a durable, queryable record. In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { executeMission } from "@/lib/missions/mission-runtime";
import { clearExecutors } from "@/lib/missions/executor-registry";
import { registerActionExecutor, ACTION_EXECUTOR_KEY } from "@/lib/missions/executors/action-executor";
import { getMissionExecution, listMissionExecutions } from "@/lib/missions/mission-execution-store";
import { resetGovernanceEnforcementOverrides } from "@/lib/dataops/ontology/governance/governance-enforcement";
import type { OntologyGraph } from "@/lib/dataops/ontology/graph/graph-types";
import type { MissionDefinition } from "@/lib/missions/mission-types";

const EMPTY: OntologyGraph = { objects: [], links: [] };
const WARN = { graph: EMPTY, mode: "warn" as const };
const ctx = () => systemActor("tnt_ms011");

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGovernanceEnforcementOverrides();
  clearExecutors();
  registerActionExecutor(); // re-register after clear (production wires via bootstrap)
  // Generic test actions (no business logic).
  registerAction({ key: "test.echo", run: async (_c, input) => ({ echoed: input }) });
  registerAction({ key: "test.blocked", precondition: () => "not allowed", run: async () => ({}) });
});
afterEach(() => clearExecutors());

function actionMission(actionKey: string, actionInput: Record<string, unknown> = {}): MissionDefinition {
  return { id: "m1", tasks: [{ id: "a", executor: ACTION_EXECUTOR_KEY, input: { actionKey, actionInput } }] };
}

test("action executor runs a governed action and completes the task", async () => {
  const r = await executeMission(ctx(), actionMission("test.echo", { x: 1 }), WARN);
  assert.equal(r.executionState, "completed");
  const taskA = r.tasks.find((t) => t.id === "a")!;
  assert.equal(taskA.state, "completed");
  // Output carries the governed action execution id + result.
  assert.ok(taskA.output?.actionExecutionId);
  assert.deepEqual((taskA.output?.result as { echoed: unknown }).echoed, { x: 1 });
  // The action engine actually executed (an ActionExecution row exists, completed).
  const execs = await db.actionExecutions.list(ctx().tenantId, (e) => e.actionId === "test.echo");
  assert.equal(execs.length, 1);
  assert.equal(execs[0]!.status, "completed");
});

test("a blocked action fails the task (fail-closed)", async () => {
  const r = await executeMission(ctx(), actionMission("test.blocked"), WARN);
  assert.equal(r.executionState, "failed");
  const taskA = r.tasks.find((t) => t.id === "a")!;
  assert.equal(taskA.state, "failed");
  assert.match(taskA.error ?? "", /blocked/);
});

test("missing actionKey fails the task with a clear error", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: ACTION_EXECUTOR_KEY, input: {} }] };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "failed");
  assert.match(r.tasks[0]!.error ?? "", /actionKey/);
});

test("mission execution is persisted and queryable", async () => {
  const r = await executeMission(ctx(), actionMission("test.echo", { x: 2 }), WARN);
  const stored = await getMissionExecution(ctx(), r.executionId);
  assert.ok(stored, "execution persisted");
  assert.equal(stored!.id, r.executionId);
  assert.equal(stored!.report.executionState, "completed");
  assert.equal(stored!.report.missionId, "m1");
  // Queryable by mission id.
  const byMission = await listMissionExecutions(ctx(), "m1");
  assert.equal(byMission.length, 1);
});

test("even a governance-blocked mission is persisted", async () => {
  // Candidate with out-of-domain status → object-stage blocking → enforce blocks.
  const graph: OntologyGraph = {
    objects: [{ id: "c1", tenantId: "t", objectType: "Candidate", externalKey: "c1", title: "c1", status: "bogus", properties: {}, createdAt: "t0", updatedAt: "t0" }],
    links: [],
  };
  const r = await executeMission(ctx(), actionMission("test.echo"), { graph, mode: "enforce" });
  assert.equal(r.executionState, "blocked");
  const stored = await getMissionExecution(ctx(), r.executionId);
  assert.ok(stored, "blocked execution persisted");
  assert.equal(stored!.report.executionState, "blocked");
  // The action never ran.
  assert.equal((await db.actionExecutions.list(ctx().tenantId, (e) => e.actionId === "test.echo")).length, 0);
});

test("multi-task action mission persists with per-task records", async () => {
  const m: MissionDefinition = {
    id: "m2",
    tasks: [
      { id: "a", executor: ACTION_EXECUTOR_KEY, input: { actionKey: "test.echo", actionInput: { n: 1 } } },
      { id: "b", executor: ACTION_EXECUTOR_KEY, input: { actionKey: "test.echo", actionInput: { n: 2 } }, dependsOn: ["a"] },
    ],
  };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "completed");
  const stored = await getMissionExecution(ctx(), r.executionId);
  assert.equal(stored!.report.tasks.length, 2);
  assert.ok(stored!.report.tasks.every((t) => t.state === "completed"));
});
