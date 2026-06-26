// Phase 8 — Command Center demo mode shows only the pack's demo objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import "@/lib/domain-packs/packs";

test("demo mode shows demo objects and excludes non-demo work", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await installDomainPack(ctx, getDomainPackManifest("healthcare_ops")!);
  // A non-demo customer object that must NOT appear in demo mode.
  await upsertObject(ctx, { objectType: "RiskSignal", externalKey: "real-risk", title: "Real Risk", properties: { severity: "high" } });

  const overview = await getCommandCenterOverview(ctx, { demoMode: true, packKey: "healthcare_ops" });
  const recs = overview.recommendationQueue;
  assert.ok(recs.length > 0, "expected demo objects in recommendation queue");
  assert.ok(recs.every((i) => i.metadata?.packKey === "healthcare_ops" || i.objectRef?.objectType !== "RiskSignal"));
  // The real risk signal is not surfaced in demo mode.
  assert.equal(overview.riskQueue.some((i) => i.title === "Real Risk"), false);
});
