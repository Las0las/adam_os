// Phase 5 (Part N) — unit tests for the Command Center ranking model. Pure math
// over CommandCenterItem literals with a fixed referenceTime so age/due windows
// are deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriorityScore, rankItems } from "@/lib/domains/command-center/command-center-rankers";
import type {
  CommandCenterItem,
  CommandItemStatus,
  CommandSeverity,
} from "@/lib/domains/command-center/command-center-types";

const REF = "2026-06-25T12:00:00.000Z";

function item(overrides: Partial<CommandCenterItem> = {}): CommandCenterItem {
  return {
    id: "i1",
    tenantId: "tnt_test",
    domain: "mission_control",
    kind: "action",
    title: "Item",
    status: "open",
    severity: null,
    priorityScore: 0,
    // createdAt at the reference time => 0h old, no age bonus by default.
    createdAt: REF,
    ...overrides,
  };
}

const opts = { mode: "executive" as const, referenceTime: REF };

test("severity ranks critical > high > medium > low", () => {
  const severities: CommandSeverity[] = ["critical", "high", "medium", "low"];
  const scores = severities.map((severity) =>
    computePriorityScore(item({ severity }), opts),
  );
  // Strictly descending.
  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(scores[i - 1]! > scores[i]!, `${severities[i - 1]} should outrank ${severities[i]}`);
  }
});

test("blocked and failed statuses add status weight over open", () => {
  const open = computePriorityScore(item({ status: "open" }), opts);
  const blocked = computePriorityScore(item({ status: "blocked" }), opts);
  const failed = computePriorityScore(item({ status: "failed" }), opts);
  assert.ok(blocked > open, "blocked outweighs open");
  assert.ok(failed > open, "failed outweighs open");
  // failed (45) > blocked (40) per the status weights.
  assert.ok(failed > blocked, "failed outweighs blocked");
});

test("a referenceTime making an item >72h old adds +20", () => {
  // createdAt 73h before the reference time.
  const created = new Date(Date.parse(REF) - 73 * 3_600_000).toISOString();
  const fresh = computePriorityScore(item({ status: "open", createdAt: REF }), opts);
  const old = computePriorityScore(item({ status: "open", createdAt: created }), opts);
  assert.equal(old - fresh, 20, ">72h old adds exactly +20");
});

test("a dueAt in the past adds +40", () => {
  const overdue = new Date(Date.parse(REF) - 1_000).toISOString();
  const withoutDue = computePriorityScore(item({ status: "open" }), opts);
  const withOverdue = computePriorityScore(item({ status: "open", dueAt: overdue }), opts);
  assert.equal(withOverdue - withoutDue, 40, "overdue dueAt adds exactly +40");
});

test("rankItems returns items sorted by priorityScore desc", () => {
  const low = item({ id: "low", severity: "low", status: "open", createdAt: REF });
  const high = item({ id: "high", severity: "critical", status: "failed", createdAt: REF });
  const mid = item({ id: "mid", severity: "medium", status: "awaiting_review", createdAt: REF });

  const ranked = rankItems([low, high, mid], opts);
  const scores = ranked.map((r) => r.priorityScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "sorted desc");
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["high", "mid", "low"],
    "highest-priority item first",
  );
});

test("computePriorityScore tolerates every status without throwing", () => {
  const statuses: CommandItemStatus[] = [
    "open",
    "in_progress",
    "awaiting_review",
    "awaiting_approval",
    "blocked",
    "completed",
    "failed",
  ];
  for (const status of statuses) {
    assert.equal(typeof computePriorityScore(item({ status }), opts), "number");
  }
});
