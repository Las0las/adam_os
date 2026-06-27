// MS-010 — Execution Planner + Dependency Resolver. Builds a DETERMINISTIC
// execution plan from a mission definition: dependency-ordered layers (each layer
// is internally parallelizable). No AI, no heuristics. Detects cycles and missing
// dependencies.

import type { MissionDefinition } from "./mission-types";

export interface ExecutionPlan {
  /** Task ids grouped into dependency layers; layer N depends only on layers < N.
   *  Tasks within a layer have no inter-dependencies (safe to run in parallel). */
  layers: string[][];
  /** Flat deterministic topological order. */
  order: string[];
}

export class MissionPlanError extends Error {
  readonly code: "CYCLE" | "MISSING_DEPENDENCY" | "DUPLICATE_TASK";
  readonly detail: string[];
  constructor(code: MissionPlanError["code"], message: string, detail: string[] = []) {
    super(message);
    this.name = "MissionPlanError";
    this.code = code;
    this.detail = detail;
  }
}

/** Build the execution plan. Deterministic: layers and intra-layer ordering are
 *  sorted by task id. Throws MissionPlanError on duplicate ids, missing
 *  dependencies, or dependency cycles. */
export function planMission(mission: MissionDefinition): ExecutionPlan {
  const ids = mission.tasks.map((t) => t.id);
  const idSet = new Set<string>();
  for (const tid of ids) {
    if (idSet.has(tid)) throw new MissionPlanError("DUPLICATE_TASK", `duplicate task id "${tid}"`, [tid]);
    idSet.add(tid);
  }

  const deps = new Map<string, string[]>();
  for (const t of mission.tasks) {
    const d = [...new Set(t.dependsOn ?? [])];
    for (const dep of d) {
      if (!idSet.has(dep)) {
        throw new MissionPlanError("MISSING_DEPENDENCY", `task "${t.id}" depends on unknown task "${dep}"`, [t.id, dep]);
      }
    }
    deps.set(t.id, d);
  }

  // Kahn layering with deterministic (sorted) selection.
  const remaining = new Set(ids);
  const layers: string[][] = [];
  const order: string[] = [];
  const done = new Set<string>();

  while (remaining.size > 0) {
    const layer = [...remaining]
      .filter((tid) => deps.get(tid)!.every((d) => done.has(d)))
      .sort();
    if (layer.length === 0) {
      // No progress possible → a cycle exists among the remaining tasks.
      const cycle = [...remaining].sort();
      throw new MissionPlanError("CYCLE", `dependency cycle among tasks: ${cycle.join(", ")}`, cycle);
    }
    for (const tid of layer) {
      remaining.delete(tid);
      order.push(tid);
    }
    for (const tid of layer) done.add(tid);
    layers.push(layer);
  }

  return { layers, order };
}
