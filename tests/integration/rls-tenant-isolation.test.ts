// Database-enforced tenant isolation (RLS). Proves that the Postgres backend
// blocks cross-tenant access at the row-level-security layer — not merely via the
// app's WHERE clauses — when the app connects as the non-superuser app role.
//
// Gated on RLS_TEST=1 because it requires the two-role setup:
//   1. a privileged role runs scripts/setup-runtime-rls.ts (tables + RLS + grant)
//   2. DATABASE_URL points at the granted, non-superuser app role
//   3. LAWRENCE_DB_MANAGED_SCHEMA=1 (app does not run DDL)
// See .github/workflows/ci.yml (rls job) for the canonical wiring.
import { test } from "node:test";
import assert from "node:assert/strict";

const ENABLED = process.env.RLS_TEST === "1";
const SUFFIX = String(Date.now());
const TA = `tnt_rls_a_${SUFFIX}`;
const TB = `tnt_rls_b_${SUFFIX}`;

test("postgres RLS isolates tenants below the application layer", { skip: !ENABLED }, async () => {
  const { db } = await import("@/lib/lawrence-core/db");
  const { runWithTenant } = await import("@/lib/lawrence-core/db/tenant-store");
  const { getDb } = await import("@/lib/lawrence-core/db/pg/client");

  const rowA = { id: `src_a_${SUFFIX}`, tenantId: TA, name: "A", kind: "upload", createdAt: "t" } as never;
  const rowB = { id: `src_b_${SUFFIX}`, tenantId: TB, name: "B", kind: "upload", createdAt: "t" } as never;
  await runWithTenant(TA, () => db.sources.insert(rowA));
  await runWithTenant(TB, () => db.sources.insert(rowB));

  // App-layer view: tenant A lists only its own rows.
  const aList = await runWithTenant(TA, () => db.sources.list(TA));
  assert.deepEqual(
    aList.map((r) => r.id),
    [`src_a_${SUFFIX}`],
    "tenant A lists only its own source",
  );

  // Tenant A cannot read tenant B's row by id.
  const cross = await runWithTenant(TA, () => db.sources.get(TA, `src_b_${SUFFIX}`));
  assert.equal(cross, undefined, "tenant A cannot read tenant B by id");

  // update()/getById() carry no tenant in their signature — they rely on the
  // request-scoped tenant store to set the RLS GUC. Updating A's row inside A's
  // context succeeds and persists.
  const updated = await runWithTenant(TA, () => db.sources.update(`src_a_${SUFFIX}`, { name: "A2" } as never));
  assert.equal((updated as { name: string }).name, "A2", "update resolves tenant from the store");
  const reread = await runWithTenant(TA, () => db.sources.get(TA, `src_a_${SUFFIX}`));
  assert.equal((reread as { name?: string } | undefined)?.name, "A2", "update persisted under RLS");

  // RLS proof: an UNFILTERED raw select under tenant A's GUC still returns only A —
  // isolation comes from the database, not the WHERE clause.
  const client = await getDb().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.tenant_id', $1, true)", [TA]);
    const raw = await client.query<{ id: string }>(
      "select id from rt_sources where id = any($1)",
      [[`src_a_${SUFFIX}`, `src_b_${SUFFIX}`]],
    );
    await client.query("commit");
    assert.deepEqual(
      raw.rows.map((r) => r.id),
      [`src_a_${SUFFIX}`],
      "RLS hides tenant B even on an unfiltered select",
    );
  } finally {
    client.release();
  }

  // No tenant GUC at all → fail closed (no rows visible).
  const c2 = await getDb().connect();
  try {
    const none = await c2.query<{ n: string }>(
      "select count(*)::text n from rt_sources where id = any($1)",
      [[`src_a_${SUFFIX}`, `src_b_${SUFFIX}`]],
    );
    assert.equal(none.rows[0]?.n, "0", "with no app.tenant_id, RLS exposes no rows");
  } finally {
    c2.release();
  }
});
