// Phase 5 (Part N) — unit tests for surface-mode-aware ranking. The same item
// scores differently in recruiter vs executive mode via the per-mode domain bonus.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriorityScore } from "@/lib/domains/command-center/command-center-rankers";
import type { CommandCenterItem, CommandDomain } from "@/lib/domains/command-center/command-center-types";

const REF = "2026-06-25T12:00:00.000Z";

function item(domain: CommandDomain): CommandCenterItem {
  return {
    id: `i-${domain}`,
    tenantId: "tnt_test",
    domain,
    kind: "action",
    title: "Item",
    status: "open",
    severity: "medium",
    priorityScore: 0,
    createdAt: REF,
  };
}

const recruiterOpts = { mode: "recruiter" as const, referenceTime: REF };
const executiveOpts = { mode: "executive" as const, referenceTime: REF };

test("a recruiting item scores higher in recruiter mode than executive mode", () => {
  const recruiting = item("recruiting");
  const inRecruiter = computePriorityScore(recruiting, recruiterOpts);
  const inExecutive = computePriorityScore(recruiting, executiveOpts);
  assert.ok(
    inRecruiter > inExecutive,
    "recruiting work is boosted for the recruiter persona",
  );
});

test("an executive item scores higher in executive mode than recruiter mode", () => {
  const executive = item("executive");
  const inExecutive = computePriorityScore(executive, executiveOpts);
  const inRecruiter = computePriorityScore(executive, recruiterOpts);
  assert.ok(
    inExecutive > inRecruiter,
    "executive work is boosted for the executive persona",
  );
});
