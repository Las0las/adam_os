// Phase 5 (Part N) — object-detail drawer data integration test. Boots the demo
// tenant, finds a seeded Candidate, and asserts getObjectDetail returns every
// drawer section with the expected shape and non-empty evidence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { getObjectDetail } from "@/lib/domains/object-detail/object-detail-service";

test("object detail drawer returns full governed context for a seeded Candidate", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const candidate = (await listObjects(ctx, "Candidate")).find(
    (c) => c.externalKey === "cand-marcus",
  );
  assert.ok(candidate, "seeded candidate cand-marcus present");

  const detail = await getObjectDetail(ctx, "Candidate", candidate.id);

  assert.equal(detail.object.objectType, "Candidate");
  assert.ok(Array.isArray(detail.relationships), "relationships array");
  assert.ok(Array.isArray(detail.evidence), "evidence array");
  assert.ok(Array.isArray(detail.actions), "actions array");
  assert.ok(Array.isArray(detail.reviews), "reviews array");
  assert.ok(Array.isArray(detail.traces), "traces array");
  assert.ok(Array.isArray(detail.audit), "audit array");
  assert.ok(detail.audit.length >= 0, "audit length is well-defined");

  assert.ok(detail.evidence.length >= 1, "candidate has evidence");
  assert.ok(
    detail.evidence.every((e) => e.excerpt.length > 0),
    "every evidence excerpt is non-empty",
  );

  assert.ok(
    detail.actions.some((a) => a.actionKey === "recruiting.shortlist_candidate"),
    "actions include Candidate-specific actions",
  );
});
