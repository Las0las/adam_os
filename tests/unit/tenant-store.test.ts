// Request-scoped tenant store: the context the Postgres RLS GUC is derived from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithTenant, enterTenant, currentTenantId } from "@/lib/lawrence-core/db/tenant-store";

test("currentTenantId is null with no context", () => {
  assert.equal(currentTenantId(), null);
});

test("runWithTenant binds the tenant for its async subtree and restores after", async () => {
  const inside = await runWithTenant("tnt_x", async () => {
    await Promise.resolve();
    return currentTenantId();
  });
  assert.equal(inside, "tnt_x");
  assert.equal(currentTenantId(), null, "context does not leak past runWithTenant");
});

test("nested runWithTenant uses the innermost tenant", async () => {
  await runWithTenant("tnt_outer", async () => {
    assert.equal(currentTenantId(), "tnt_outer");
    await runWithTenant("tnt_inner", async () => {
      assert.equal(currentTenantId(), "tnt_inner");
    });
    assert.equal(currentTenantId(), "tnt_outer", "restores outer tenant after nested scope");
  });
});

test("enterTenant binds the tenant for the current context", () => {
  runWithTenant("tnt_seed", () => {
    enterTenant("tnt_override");
    assert.equal(currentTenantId(), "tnt_override");
  });
});
