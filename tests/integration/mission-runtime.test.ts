// MS-010 — Mission Execution Runtime. Governance decides; the runtime executes.
// Covers success, governance block, dependency ordering, parallel layers, retries,
// approval pause/resume, failure propagation, cancellation, events, and regression
// safety. In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { executeMission, getMissionRuntimeMetrics, resetMissionRuntimeMetrics } from "@/lib/missions/mission-runtime";
import { registerExecutor, clearExecutors } from "@/lib/missions/executor-registry";
import { resetGovernanceEnforcementOverrides } from "@/lib/dataops/ontology/governance/governance-enforcement";
import type { OntologyGraph, OntologyObject } from "@/lib/dataops/ontology/graph/graph-types";
import type { MissionDefinition } from "@/lib/missions/mission-types";

const EMPTY_GRAPH: OntologyGraph = { objects: [], links: [] };
function obj(id: string, objectType: string, status: string | null): OntologyObject {
  return { id, tenantId: "t", objectType, externalKey: id, title: id, status, properties: {}, createdAt: "t0", updatedAt: "t0" };
}

// Shared recorder of executed task ids (proves ordering).
let executed: string[];

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGovernanceEnforcementOverrides();
  resetMissionRuntimeMetrics();
  clearExecutors();
  executed = [];
  registerExecutor({ key: "record", execute: (i) => { executed.push(i.taskId); return { output: { ran: i.taskId } }; } });
  registerExecutor({ key: "fail", execute: (i) => { throw new Error(`boom:${i.taskId}`); } });
});
afterEach(() => clearExecutors());

const ctx = () => systemActor("tnt_mission");
const WARN = { graph: EMPTY_GRAPH, mode: "warn" as const };

test("successful mission completes and emits events", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "record" }, { id: "b", executor: "record", dependsOn: ["a"] }] };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "completed");
  assert.equal(r.summary.completed, 2);
  assert.deepEqual(executed, ["a", "b"]); // dependency ordering
  assert.ok(r.events.some((e) => e.type === "mission.started"));
  assert.ok(r.events.some((e) => e.type === "mission.completed"));
  assert.equal(getMissionRuntimeMetrics().completed, 1);
  // audit events recorded
  assert.ok((await db.auditEvents.list(ctx().tenantId, (e) => e.action === "mission.completed")).length >= 1);
});

test("governance-blocked mission aborts before any task runs", async () => {
  // Candidate with out-of-domain status → object-stage blocking finding; enforce blocks.
  const graph: OntologyGraph = { objects: [obj("c1", "Candidate", "bogus")], links: [] };
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "record" }] };
  const r = await executeMission(ctx(), m, { graph, mode: "enforce" });
  assert.equal(r.executionState, "blocked");
  assert.equal(r.governance.executionDecision, "BLOCKED");
  assert.equal(executed.length, 0); // no task ran
  assert.equal(getMissionRuntimeMetrics().blocked, 1);
});

test("parallel layer + dependency convergence", async () => {
  const m: MissionDefinition = {
    id: "m1",
    tasks: [
      { id: "a", executor: "record" },
      { id: "b", executor: "record" },
      { id: "c", executor: "record", dependsOn: ["a", "b"] },
    ],
  };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "completed");
  // a and b (layer 0) run before c (layer 1)
  assert.ok(executed.indexOf("a") < executed.indexOf("c"));
  assert.ok(executed.indexOf("b") < executed.indexOf("c"));
});

test("deterministic retries: succeed on the 3rd attempt", async () => {
  let attempts = 0;
  registerExecutor({ key: "flaky", execute: () => { attempts += 1; if (attempts < 3) throw new Error("transient"); return {}; } });
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "flaky", retry: { maxAttempts: 3 } }] };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "completed");
  assert.equal(r.tasks[0]!.attempts, 3);
  assert.equal(r.retryStatistics.totalRetries, 2);
});

test("retry exhaustion fails the task and propagates to dependents", async () => {
  const m: MissionDefinition = {
    id: "m1",
    tasks: [
      { id: "a", executor: "fail", retry: { maxAttempts: 2 } },
      { id: "b", executor: "record", dependsOn: ["a"] },
      { id: "c", executor: "record" },
    ],
  };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "failed");
  assert.equal(r.tasks.find((t) => t.id === "a")!.state, "failed");
  assert.equal(r.tasks.find((t) => t.id === "a")!.attempts, 2);
  assert.equal(r.tasks.find((t) => t.id === "b")!.state, "skipped"); // dependent skipped
  assert.equal(r.tasks.find((t) => t.id === "c")!.state, "completed"); // independent branch runs
  assert.ok(r.events.some((e) => e.type === "mission.task.failed"));
});

test("approval pause then resume", async () => {
  const m: MissionDefinition = {
    id: "m1",
    tasks: [{ id: "a", executor: "record", requiresApproval: true }, { id: "b", executor: "record", dependsOn: ["a"] }],
  };
  // Run 1: no approval → pause (waiting).
  const r1 = await executeMission(ctx(), m, WARN);
  assert.equal(r1.executionState, "waiting");
  assert.deepEqual(r1.pendingApprovals, ["a"]);
  assert.equal(executed.length, 0);
  assert.ok(r1.events.some((e) => e.type === "mission.paused"));

  // Run 2: approval granted → completes.
  executed = [];
  const r2 = await executeMission(ctx(), m, { ...WARN, approvals: ["a"] });
  assert.equal(r2.executionState, "completed");
  assert.deepEqual(executed, ["a", "b"]);
});

test("cancellation marks the mission cancelled", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "record" }] };
  const r = await executeMission(ctx(), m, { ...WARN, cancelled: () => true });
  assert.equal(r.executionState, "cancelled");
  assert.equal(executed.length, 0);
  assert.equal(r.tasks[0]!.state, "cancelled");
  assert.ok(r.events.some((e) => e.type === "mission.cancelled"));
});

test("plan error (cycle) fails the mission deterministically", async () => {
  const m: MissionDefinition = {
    id: "m1",
    tasks: [{ id: "a", executor: "record", dependsOn: ["b"] }, { id: "b", executor: "record", dependsOn: ["a"] }],
  };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "failed");
  assert.ok(r.events.some((e) => e.type === "mission.failed"));
});

test("missing executor fails the task (not a crash)", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "does_not_exist" }] };
  const r = await executeMission(ctx(), m, WARN);
  assert.equal(r.executionState, "failed");
  assert.match(r.tasks[0]!.error ?? "", /no executor/);
});

test("no write-path changes: running a mission creates no ontology objects/links", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "record" }] };
  await executeMission(ctx(), m, WARN);
  assert.equal((await db.ontologyObjects.list(ctx().tenantId)).length, 0);
  assert.equal((await db.ontologyLinks.list(ctx().tenantId)).length, 0);
});

test("deterministic report across runs", async () => {
  const m: MissionDefinition = { id: "m1", tasks: [{ id: "a", executor: "record" }, { id: "b", executor: "record", dependsOn: ["a"] }] };
  const r1 = await executeMission(ctx(), m, WARN);
  executed = [];
  const r2 = await executeMission(ctx(), m, WARN);
  assert.deepEqual(r1.tasks.map((t) => [t.id, t.state]), r2.tasks.map((t) => [t.id, t.state]));
  assert.equal(r1.executionState, r2.executionState);
});
