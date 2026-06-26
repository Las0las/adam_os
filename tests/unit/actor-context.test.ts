// Identity slice: actor-context resolution decision logic. The Clerk-dependent
// resolution runs only inside a request context; here we prove the pure rules —
// when the demo fallback is allowed (preserve dev/test/demo), when it is refused
// (fail closed in production with Clerk), tenant resolution, and the org-role
// permission grant.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClerkConfigured,
  shouldAllowDemoAuth,
  resolveTenantId,
  permissionsForOrgRole,
} from "@/lib/app/demo-context";
import { DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";

test("isClerkConfigured requires both keys", () => {
  assert.equal(isClerkConfigured({}), false);
  assert.equal(isClerkConfigured({ CLERK_SECRET_KEY: "sk" }), false);
  assert.equal(
    isClerkConfigured({ CLERK_SECRET_KEY: "sk", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk" }),
    true,
  );
});

test("shouldAllowDemoAuth: dev/test (no Clerk, not production) allows the demo actor", () => {
  assert.equal(shouldAllowDemoAuth({}), true);
});

test("shouldAllowDemoAuth: production without Clerk fails closed", () => {
  assert.equal(shouldAllowDemoAuth({ NODE_ENV: "production" }), false);
});

test("shouldAllowDemoAuth: Clerk configured always requires a real session", () => {
  assert.equal(
    shouldAllowDemoAuth({ CLERK_SECRET_KEY: "sk", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk" }),
    false,
  );
});

test("shouldAllowDemoAuth: explicit override allows the demo actor even in production", () => {
  assert.equal(shouldAllowDemoAuth({ NODE_ENV: "production", LAWRENCE_ALLOW_DEMO_AUTH: "1" }), true);
});

test("resolveTenantId: org id wins, else default tenant, else demo tenant", () => {
  assert.equal(resolveTenantId("org_123", {}), "org_123");
  assert.equal(resolveTenantId(null, { LAWRENCE_DEFAULT_TENANT_ID: "tnt_acme" }), "tnt_acme");
  assert.equal(resolveTenantId(null, {}), DEMO_TENANT_ID);
});

test("permissionsForOrgRole: admins get full authority, others least-privilege", () => {
  assert.ok(permissionsForOrgRole("org:admin").includes("mission_control.admin"));
  assert.ok(permissionsForOrgRole("admin").length >= 9);
  assert.deepEqual(permissionsForOrgRole("org:member"), ["review.reviewer"]);
  assert.deepEqual(permissionsForOrgRole(null), ["review.reviewer"]);
});
