// Phase 10 — object policy engine: default-deny, deny-override, tenant match,
// and role-permission grant. Pure evaluation, no store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateObjectAccess } from "@/lib/security/object-policy-engine";
import type { SecurityContext } from "@/lib/security/security-types";
import type { ObjectAclEntry } from "@/lib/security/access-control-types";

function ctx(permissions: SecurityContext["permissions"]): SecurityContext {
  return { tenantId: "t1", userId: "u1", roleKeys: [], groupIds: [], permissions };
}
function acl(effect: "allow" | "deny"): ObjectAclEntry {
  return {
    id: "a", tenantId: "t1", objectType: "Doc", objectId: "d1",
    principalType: "user", principalId: "u1", permission: "read", effect,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}
const base = { objectType: "Doc", objectId: "d1", permission: "read" as const };

test("default-deny when no ACL, policy, or role permission", () => {
  const d = evaluateObjectAccess({ securityContext: ctx([]), objectTenantId: "t1", acls: [], policies: [], ...base });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "default deny");
});

test("role permission grants access", () => {
  const d = evaluateObjectAccess({ securityContext: ctx(["security.admin"]), objectTenantId: "t1", acls: [], policies: [], ...base });
  assert.equal(d.allowed, true);
});

test("explicit deny ACL overrides allow ACL", () => {
  const d = evaluateObjectAccess({ securityContext: ctx(["security.admin"]), objectTenantId: "t1", acls: [acl("allow"), acl("deny")], policies: [], ...base });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "explicit deny ACL");
});

test("tenant mismatch is always denied even with allow ACL", () => {
  const d = evaluateObjectAccess({ securityContext: ctx(["security.admin"]), objectTenantId: "t_other", acls: [acl("allow")], policies: [], ...base });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "tenant mismatch");
});

test("explicit allow ACL grants without role permission", () => {
  const d = evaluateObjectAccess({ securityContext: ctx([]), objectTenantId: "t1", acls: [acl("allow")], policies: [], ...base });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "explicit allow ACL");
});
