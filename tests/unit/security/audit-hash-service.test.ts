// Phase 10 — audit hashing is deterministic, chained, and tamper-evident.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEventHash } from "@/lib/lawrence-core/audit/audit-hash-service";

const ev = {
  tenantId: "t1",
  action: "thing.created",
  subjectType: "thing",
  subjectId: "x1",
  metadata: { a: 1 },
  createdAt: "1970-01-01T00:00:01.000Z",
};

test("hash is deterministic and 64 hex chars", () => {
  const h1 = computeEventHash(ev, null);
  const h2 = computeEventHash(ev, null);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("changing the previous hash changes the chained hash", () => {
  const a = computeEventHash(ev, null);
  const b = computeEventHash(ev, a);
  assert.notEqual(a, b);
});

test("tampering with metadata changes the hash", () => {
  const clean = computeEventHash(ev, null);
  const tampered = computeEventHash({ ...ev, metadata: { a: 2 } }, null);
  assert.notEqual(clean, tampered);
});
