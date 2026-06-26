// Phase 10 — a security context for tenant A can never read an object whose
// tenant is B, regardless of permissions or an allow ACL. The non-negotiable
// tenant boundary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { checkObjectAccess } from "@/lib/security/object-access-service";
import type { SecurityContext } from "@/lib/security/security-types";

test("cross-tenant object access is denied even with admin permissions", async () => {
  await resetDatabase();
  resetClock();
  const ctxA: SecurityContext = {
    tenantId: "tnt_a", userId: "u", roleKeys: [], groupIds: [], permissions: ["security.admin", "dataops.admin"],
  };
  const decision = await checkObjectAccess(ctxA, {
    objectType: "Doc",
    objectId: "doc_in_b",
    permission: "read",
    objectTenantId: "tnt_b",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "tenant mismatch");
});

test("same-tenant admin read is allowed", async () => {
  await resetDatabase();
  resetClock();
  const ctxA: SecurityContext = {
    tenantId: "tnt_a", userId: "u", roleKeys: [], groupIds: [], permissions: ["security.admin"],
  };
  const decision = await checkObjectAccess(ctxA, {
    objectType: "Doc", objectId: "doc_in_a", permission: "read", objectTenantId: "tnt_a",
  });
  assert.equal(decision.allowed, true);
});
