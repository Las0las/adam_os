// Phase 10 — classification ordering + effective resolution (most-sensitive wins).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  moreSensitive,
  classifyObject,
  getEffectiveClassification,
} from "@/lib/security/data-classification-service";

test("moreSensitive picks the higher classification", () => {
  assert.equal(moreSensitive("public", "credential"), "credential");
  assert.equal(moreSensitive("pii", "confidential"), "pii");
  assert.equal(moreSensitive("internal", "public"), "internal");
});

test("effective classification is the most sensitive recorded", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await classifyObject(ctx, { objectType: "Doc", objectId: "d1", classification: "confidential" });
  await classifyObject(ctx, { objectType: "Doc", objectId: "d1", classification: "credential" });
  const eff = await getEffectiveClassification("tnt_test", "Doc", "d1");
  assert.equal(eff, "credential");
});

test("effective classification is null when unclassified", async () => {
  await resetDatabase();
  resetClock();
  const eff = await getEffectiveClassification("tnt_test", "Doc", "missing");
  assert.equal(eff, null);
});
