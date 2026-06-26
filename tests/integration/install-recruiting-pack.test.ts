// Phase 8 — installing the recruiting pack creates installation + demo objects +
// eval suites + audit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";

test("recruiting pack installs with evals + audit", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const res = await installDomainPack(ctx, getDomainPackManifest("recruiting")!);
  assert.equal(res.installation.status, "installed");

  // Eval suites installed.
  const suites = await db.evalSuites.list(ctx.tenantId);
  assert.ok(suites.some((s) => s.key === "recruiting_candidate_fit_retrieval_eval"));

  // Demo objects marked.
  assert.ok((await db.ontologyObjects.list(ctx.tenantId, (o) => o.properties.__packKey === "recruiting")).length > 0);

  // Audit emitted.
  const audit = await db.auditEvents.list(ctx.tenantId, (a) => a.action === "domain_pack.installed");
  assert.equal(audit.length, 1);
});
