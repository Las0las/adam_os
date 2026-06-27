// ONT-002 relationship enforce-mode (ADR-0008). linkObjects warns (default) or
// rejects (enforce) invalid REGISTERED relationships, resolved per tenant.
// Unregistered relationship types are never rejected. Valid edges pass in both
// modes. In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { linkObjects } from "@/lib/dataops/ontology/object-service";
import { RelationshipSchemaError } from "@/lib/dataops/ontology/relationships/errors";
import {
  setTenantRelationshipEnforcementMode,
  setGlobalRelationshipEnforcementMode,
  resetRelationshipEnforcementOverrides,
} from "@/lib/dataops/ontology/relationships/enforcement";

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetRelationshipEnforcementOverrides();
});
afterEach(() => resetRelationshipEnforcementOverrides());

async function auditByAction(tenantId: string, action: string) {
  return await db.auditEvents.list(tenantId, (e) => e.action === action);
}

// An invalid use of a REGISTERED relationship: `targets` is Submission -> Job;
// reversing it (Job -> Submission) is an invalid_direction on a known linkType.
const INVALID_REGISTERED = {
  linkType: "targets",
  from: { objectType: "Job", objectId: "j1" },
  to: { objectType: "Submission", objectId: "s1" },
};

const VALID = {
  linkType: "submitted",
  from: { objectType: "Candidate", objectId: "c1" },
  to: { objectType: "Submission", objectId: "s1" },
};

const UNREGISTERED = {
  linkType: "totally_unknown",
  from: { objectType: "Candidate", objectId: "c1" },
  to: { objectType: "Account", objectId: "a1" },
};

test("warn mode (default): invalid registered relationship warns but persists", async () => {
  const ctx = systemActor("tnt_warn");
  const link = await linkObjects(ctx, INVALID_REGISTERED);
  assert.ok(link.id, "edge persisted in warn mode");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.warning")).length, 1);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.rejected")).length, 0);
});

test("enforce mode: invalid registered relationship is rejected before persistence", async () => {
  const ctx = systemActor("tnt_enf");
  setTenantRelationshipEnforcementMode(ctx.tenantId, "enforce");

  await assert.rejects(
    () => linkObjects(ctx, INVALID_REGISTERED),
    (err: unknown) => {
      assert.ok(err instanceof RelationshipSchemaError);
      assert.equal(err.linkType, "targets");
      assert.ok(err.violations.some((v) => v.code === "invalid_direction"));
      return true;
    },
  );

  const persisted = await db.ontologyLinks.find(
    ctx.tenantId,
    (l) => l.linkType === "targets" && l.fromObjectId === "j1" && l.toObjectId === "s1",
  );
  assert.equal(persisted, undefined, "no edge persisted on rejection");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.rejected")).length, 1);
});

test("enforce mode: valid canonical relationship passes", async () => {
  const ctx = systemActor("tnt_enf_ok");
  setGlobalRelationshipEnforcementMode("enforce");
  const link = await linkObjects(ctx, VALID);
  assert.ok(link.id);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.rejected")).length, 0);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.warning")).length, 0);
});

test("warn mode: valid canonical relationship passes silently", async () => {
  const ctx = systemActor("tnt_warn_ok");
  const link = await linkObjects(ctx, VALID);
  assert.ok(link.id);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.warning")).length, 0);
});

test("enforce mode: UNREGISTERED relationship type is NOT rejected (warns, persists)", async () => {
  const ctx = systemActor("tnt_enf_unreg");
  setTenantRelationshipEnforcementMode(ctx.tenantId, "enforce");
  const link = await linkObjects(ctx, UNREGISTERED);
  assert.ok(link.id, "unregistered edge persisted even under enforce");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.rejected")).length, 0);
  const warnings = await auditByAction(ctx.tenantId, "ontology.relationship.warning");
  assert.equal(warnings.length, 1);
  const meta = warnings[0]!.metadata as { violations: { code: string }[] };
  assert.deepEqual(meta.violations.map((v) => v.code), ["unknown_relationship_type"]);
});

test("warn mode: unregistered relationship type warns and persists", async () => {
  const ctx = systemActor("tnt_warn_unreg");
  const link = await linkObjects(ctx, UNREGISTERED);
  assert.ok(link.id);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.relationship.warning")).length, 1);
});

test("tenant override: enforce for one tenant does not affect another (default warn)", async () => {
  const enforced = systemActor("tnt_a");
  const defaulted = systemActor("tnt_b");
  setTenantRelationshipEnforcementMode(enforced.tenantId, "enforce");

  await assert.rejects(() => linkObjects(enforced, INVALID_REGISTERED), RelationshipSchemaError);
  // tnt_b has no override → warn → persists.
  const link = await linkObjects(defaulted, INVALID_REGISTERED);
  assert.ok(link.id);
  assert.equal((await auditByAction(defaulted.tenantId, "ontology.relationship.warning")).length, 1);
});

test("enforce mode: cardinality breach on a registered relationship is rejected", async () => {
  const ctx = systemActor("tnt_card");
  setTenantRelationshipEnforcementMode(ctx.tenantId, "enforce");
  // First targets edge is valid.
  await linkObjects(ctx, { linkType: "targets", from: { objectType: "Submission", objectId: "sub1" }, to: { objectType: "Job", objectId: "jobA" } });
  // Second targets edge from the SAME submission → many_to_one breach → rejected.
  await assert.rejects(
    () => linkObjects(ctx, { linkType: "targets", from: { objectType: "Submission", objectId: "sub1" }, to: { objectType: "Job", objectId: "jobB" } }),
    (err: unknown) => {
      assert.ok(err instanceof RelationshipSchemaError);
      assert.ok(err.violations.some((v) => v.code === "cardinality"));
      return true;
    },
  );
});
