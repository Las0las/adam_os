import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { installAllDomainPacks, listDomainSeedPacks } from "@/lib/domains/domain-seed-runner";
import "@/lib/domains/phase4-packs";

async function fresh() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("all five Phase 4 domain seed packs are registered", () => {
  const keys = listDomainSeedPacks().map((p) => p.key);
  for (const k of ["recruiting", "onboarding", "support", "claims", "executive"]) {
    assert.ok(keys.includes(k), `pack missing: ${k}`);
  }
});

test("installAllDomainPacks seeds objects across every domain", async () => {
  const ctx = await fresh();
  await installAllDomainPacks(ctx);
  assert.ok((await listObjects(ctx, "Candidate")).some((o) => o.externalKey === "cand-marcus"));
  assert.ok((await listObjects(ctx, "OnboardingCase")).some((o) => o.externalKey === "case-hali"));
  assert.ok((await listObjects(ctx, "SupportTicket")).some((o) => o.externalKey === "ticket-vpn"));
  assert.ok((await listObjects(ctx, "ValidationCase")).some((o) => o.externalKey === "clm-001"));
  assert.ok((await listObjects(ctx, "Account")).some((o) => o.externalKey === "acct-meridian"));
});

test("seed install is idempotent (no duplicate objects)", async () => {
  const ctx = await fresh();
  await installAllDomainPacks(ctx);
  const before = (await listObjects(ctx)).length;
  await installAllDomainPacks(ctx);
  const after = (await listObjects(ctx)).length;
  assert.equal(before, after);
});

test("seed install emits domain.seed_pack.installed audit per pack", async () => {
  const ctx = await fresh();
  await installAllDomainPacks(ctx);
  const installed = (await listAudit(ctx.tenantId)).filter((e) => e.action === "domain.seed_pack.installed");
  assert.ok(installed.length >= 5);
});

test("seed packs are tenant-scoped", async () => {
  const ctx = await fresh();
  await installAllDomainPacks(ctx);
  const other = systemActor("tnt_other");
  assert.equal((await listObjects(other)).length, 0);
  assert.equal((await db.notificationRules.list(other.tenantId)).length, 0);
});
