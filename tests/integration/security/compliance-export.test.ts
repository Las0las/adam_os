// Phase 10 — compliance export seals a checksum, full_evidence is redacted, and
// full_evidence requires its own grant (compliance_export alone is insufficient).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import {
  createComplianceExport,
  getComplianceExportBundle,
} from "@/lib/security/compliance-export-service";
import type { ActorContext } from "@/types/platform";

test("audit export completes with a sha256 checksum", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await upsertObject(ctx, { objectType: "Doc", title: "x", properties: {} });
  const exp = await createComplianceExport(ctx, "audit");
  assert.equal(exp.status, "completed");
  assert.match(exp.checksumSha256 ?? "", /^[0-9a-f]{64}$/);
});

test("full_evidence export redacts excerpts before they leave", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const obj = await upsertObject(ctx, { objectType: "Doc", title: "x", properties: {} });
  await indexEvidence(ctx, { objectType: "Doc", objectId: obj.id }, "patient ada@example.com sk-ant-ABCDEFGHIJKLMNOPQRSTUV");
  const exp = await createComplianceExport(ctx, "full_evidence");
  const bundle = await getComplianceExportBundle(ctx, exp.id);
  const json = JSON.stringify(bundle?.bundle);
  assert.ok(!json.includes("ada@example.com"));
  assert.ok(!json.includes("sk-ant-ABCDEFGHIJKLMNOPQRSTUV"));
});

test("full_evidence requires the full_evidence_export grant", async () => {
  await resetDatabase();
  resetClock();
  // Has compliance_export but NOT full_evidence_export.
  const limited: ActorContext = { tenantId: "tnt_test", actorUserId: "u", permissions: ["security.compliance_export"] };
  await assert.rejects(() => createComplianceExport(limited, "full_evidence"));
  // But can run a normal compliance export.
  const exp = await createComplianceExport(limited, "access");
  assert.equal(exp.status, "completed");
});
