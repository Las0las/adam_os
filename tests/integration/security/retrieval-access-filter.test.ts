// Phase 10 — the AI retrieval guard: hits the caller cannot read are removed,
// surviving excerpts are redacted before they reach prompt context, and the
// denied-hit count is recorded in the trace. No AI side door.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { setObjectAcl } from "@/lib/security/object-acl-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import type { ActorContext } from "@/types/platform";

test("retrieval drops unauthorized hits, redacts excerpts, and counts denials", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");

  const allowed = await upsertObject(admin, { objectType: "Doc", title: "allowed", properties: {} });
  const denied = await upsertObject(admin, { objectType: "Doc", title: "denied", properties: {} });

  // Both chunks match the query "alpha"; the allowed one also carries a secret.
  await indexEvidence(admin, { objectType: "Doc", objectId: allowed.id }, "alpha contact ada@example.com secret note");
  await indexEvidence(admin, { objectType: "Doc", objectId: denied.id }, "alpha confidential other note");

  // Reader can read only the allowed doc (explicit allow ACL); denied doc → default deny.
  const reader: ActorContext = { tenantId: "tnt_test", actorUserId: "usr_r", permissions: [] };
  await setObjectAcl(admin, {
    objectType: "Doc", objectId: allowed.id, principalType: "user", principalId: "usr_r", permission: "read", effect: "allow",
  });

  const res = await retrieve(reader, { tenantId: "tnt_test", query: "alpha", methods: ["keyword"] });

  // Only the allowed object survives.
  assert.ok(res.hits.every((h) => h.objectId === allowed.id));
  assert.ok(res.hits.length >= 1);
  // The denied doc was counted.
  assert.ok((res.trace?.deniedHitCount as number) >= 1);
  // The surviving excerpt is redacted (no raw PII reaches prompt context).
  assert.ok(res.hits.every((h) => !h.excerpt.includes("ada@example.com")));
});

test("a reader with no access gets zero hits and all denied", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");
  const obj = await upsertObject(admin, { objectType: "Doc", title: "x", properties: {} });
  await indexEvidence(admin, { objectType: "Doc", objectId: obj.id }, "beta something");
  const reader: ActorContext = { tenantId: "tnt_test", actorUserId: "usr_none", permissions: [] };
  const res = await retrieve(reader, { tenantId: "tnt_test", query: "beta", methods: ["keyword"] });
  assert.equal(res.hits.length, 0);
  assert.ok((res.trace?.deniedHitCount as number) >= 1);
});
