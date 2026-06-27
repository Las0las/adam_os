// MS-010 — Execution Planner. Deterministic dependency-ordered layers; cycle and
// missing-dependency detection. Pure (no DB).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planMission, MissionPlanError } from "@/lib/missions/execution-planner";
import type { MissionDefinition } from "@/lib/missions/mission-types";

function mission(tasks: MissionDefinition["tasks"]): MissionDefinition {
  return { id: "m1", tasks };
}

test("deterministic layers respect dependency ordering", () => {
  const plan = planMission(
    mission([
      { id: "c", executor: "x", dependsOn: ["a", "b"] },
      { id: "a", executor: "x" },
      { id: "b", executor: "x" },
      { id: "d", executor: "x", dependsOn: ["c"] },
    ]),
  );
  assert.deepEqual(plan.layers, [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual(plan.order, ["a", "b", "c", "d"]);
});

test("independent tasks share a parallelizable layer", () => {
  const plan = planMission(mission([{ id: "a", executor: "x" }, { id: "b", executor: "x" }, { id: "c", executor: "x" }]));
  assert.deepEqual(plan.layers, [["a", "b", "c"]]);
});

test("cycle is detected", () => {
  assert.throws(
    () => planMission(mission([{ id: "a", executor: "x", dependsOn: ["b"] }, { id: "b", executor: "x", dependsOn: ["a"] }])),
    (err: unknown) => {
      assert.ok(err instanceof MissionPlanError);
      assert.equal(err.code, "CYCLE");
      return true;
    },
  );
});

test("missing dependency is detected", () => {
  assert.throws(
    () => planMission(mission([{ id: "a", executor: "x", dependsOn: ["ghost"] }])),
    (err: unknown) => {
      assert.ok(err instanceof MissionPlanError);
      assert.equal(err.code, "MISSING_DEPENDENCY");
      return true;
    },
  );
});

test("duplicate task id is detected", () => {
  assert.throws(
    () => planMission(mission([{ id: "a", executor: "x" }, { id: "a", executor: "y" }])),
    (err: unknown) => {
      assert.ok(err instanceof MissionPlanError);
      assert.equal(err.code, "DUPLICATE_TASK");
      return true;
    },
  );
});
