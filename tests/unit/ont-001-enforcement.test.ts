// ONT-001 reject-mode enforcement (ADR-0006). Validation runs inside upsertObject
// and either WARNS (default, observe-only) or REJECTS (enforce, fail-closed),
// resolved per tenant. Unregistered object types are unaffected in both modes.
// In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { OntologySchemaError } from "@/lib/dataops/ontology/schemas/errors";
import {
  setTenantEnforcementMode,
  setGlobalEnforcementMode,
  resetEnforcementOverrides,
} from "@/lib/dataops/ontology/schemas/enforcement";

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetEnforcementOverrides();
});
afterEach(() => resetEnforcementOverrides());

async function auditByAction(tenantId: string, action: string) {
  return await db.auditEvents.list(tenantId, (e) => e.action === action);
}

const INVALID_CANDIDATE = {
  objectType: "Candidate",
  externalKey: "bad-1",
  title: "x",
  status: "bogus", // not in Candidate lifecycle
  properties: {}, // missing fullName|email
};

const VALID = {
  Candidate: {
    objectType: "Candidate",
    externalKey: "c-ok",
    title: "Ada",
    status: "new",
    properties: { fullName: "Ada Lovelace", email: "ada@example.com" },
  },
  Job: {
    objectType: "Job",
    externalKey: "j-ok",
    title: "Engineer",
    status: "open",
    properties: { location: "Remote" },
  },
  Submission: {
    objectType: "Submission",
    externalKey: "s-ok",
    title: "Ada → Engineer",
    status: "submitted",
    properties: { jobKey: "j-ok", candidateKey: "c-ok", stage: "submitted" },
  },
  Account: {
    objectType: "Account",
    externalKey: "a-ok",
    title: "Acme",
    status: "active",
    properties: {},
  },
} as const;

test("warn mode (default) still persists an invalid registered object and emits a warning", async () => {
  const ctx = systemActor("tnt_warn");
  const obj = await upsertObject(ctx, INVALID_CANDIDATE);
  assert.ok(obj.id, "invalid object still persisted in warn mode");
  assert.equal(obj.status, "bogus");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.warning")).length, 1);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.rejected")).length, 0);
});

test("enforce mode rejects an invalid registered object before persistence", async () => {
  const ctx = systemActor("tnt_enf");
  setTenantEnforcementMode(ctx.tenantId, "enforce");

  await assert.rejects(
    () => upsertObject(ctx, INVALID_CANDIDATE),
    (err: unknown) => {
      assert.ok(err instanceof OntologySchemaError);
      assert.equal(err.objectType, "Candidate");
      assert.ok(err.violations.some((v) => v.code === "invalid_status"));
      assert.ok(err.violations.some((v) => v.path === "properties.fullName"));
      return true;
    },
  );

  // Fail-closed: nothing persisted, and a rejected (not warning) event was logged.
  const persisted = await db.ontologyObjects.find(
    ctx.tenantId,
    (o) => o.objectType === "Candidate" && o.externalKey === "bad-1",
  );
  assert.equal(persisted, undefined, "no object persisted on rejection");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.rejected")).length, 1);
});

test("enforce mode does NOT reject unregistered object types", async () => {
  const ctx = systemActor("tnt_enf2");
  setTenantEnforcementMode(ctx.tenantId, "enforce");
  // RecruiterNote has no registered schema → unaffected even in enforce mode.
  const obj = await upsertObject(ctx, {
    objectType: "RecruiterNote",
    externalKey: "note-1",
    title: "Note",
    status: "anything",
    properties: { body: "hi" },
  });
  assert.ok(obj.id, "unregistered type persisted in enforce mode");
  assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.rejected")).length, 0);
});

test("valid Candidate/Job/Submission/Account pass in BOTH modes", async () => {
  for (const mode of ["warn", "enforce"] as const) {
    for (const key of ["Candidate", "Job", "Submission", "Account"] as const) {
      await resetDatabase();
      resetClock();
      resetEnforcementOverrides();
      const ctx = systemActor(`tnt_${mode}_${key}`);
      if (mode === "enforce") setGlobalEnforcementMode("enforce");
      const obj = await upsertObject(ctx, VALID[key]);
      assert.ok(obj.id, `${key} valid in ${mode} mode`);
      assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.rejected")).length, 0);
      assert.equal((await auditByAction(ctx.tenantId, "ontology.schema.warning")).length, 0);
    }
  }
});

test("enforce mode for one tenant does not affect another (default warn)", async () => {
  const enforced = systemActor("tnt_a");
  const defaulted = systemActor("tnt_b");
  setTenantEnforcementMode(enforced.tenantId, "enforce");

  await assert.rejects(() => upsertObject(enforced, { ...INVALID_CANDIDATE, externalKey: "a" }), OntologySchemaError);
  // tnt_b has no override → warn → persists.
  const obj = await upsertObject(defaulted, { ...INVALID_CANDIDATE, externalKey: "b" });
  assert.ok(obj.id);
  assert.equal((await auditByAction(defaulted.tenantId, "ontology.schema.warning")).length, 1);
});
