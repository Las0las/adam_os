// Postgres backend for a Collection (Phase 3). Each collection is a jsonb
// document table `rt_<name> (id text pk, tenant_id text, data jsonb)`. The whole
// row is stored as `data`, tenant scoping is enforced in SQL, and JS predicates
// filter the returned rows — so services behave identically across both backends.
//
// Tenant isolation is defense-in-depth: every operation runs inside a
// transaction with the `app.tenant_id` GUC set (see withTenantTx), so when the
// rt_* tables have row-level security applied (db/migrations/0015 +
// scripts/setup-runtime-rls.ts) the database itself blocks cross-tenant access,
// not just the WHERE clauses below. update()/getById() carry no tenant in their
// signature, so they take it from the request-scoped tenant store.
//
// Schema ownership: by default the table is created lazily (single-role/dev).
// In the production two-role model the app connects as a NON-owner role that
// cannot run DDL; set LAWRENCE_DB_MANAGED_SCHEMA=1 so creation is skipped and the
// tables are provisioned ahead of time by the privileged setup script.

import { getDb, withTenantTx } from "./client";
import { currentTenantId } from "../tenant-store";
import type { Collection, TenantScoped } from "../collection";

const MANAGED_SCHEMA = process.env.LAWRENCE_DB_MANAGED_SCHEMA === "1";

export class PgCollection<T extends TenantScoped> implements Collection<T> {
  private readonly table: string;
  private ready: Promise<void> | null = null;

  constructor(public readonly name: string) {
    this.table = `rt_${name}`;
  }

  private ensure(): Promise<void> {
    if (!this.ready) {
      // Managed-schema deployments (non-owner app role) cannot run DDL; the
      // tables already exist via the privileged setup. Nothing to ensure.
      if (MANAGED_SCHEMA) {
        this.ready = Promise.resolve();
        return this.ready;
      }
      const db = getDb();
      this.ready = (async () => {
        await db.query(
          `create table if not exists ${this.table} (
             id text primary key,
             tenant_id text not null,
             data jsonb not null
           )`,
        );
        await db.query(
          `create index if not exists ${this.table}_tenant_idx on ${this.table} (tenant_id)`,
        );
      })();
    }
    return this.ready;
  }

  async insert(row: T): Promise<T> {
    await this.ensure();
    await withTenantTx(row.tenantId, (c) =>
      c.query(
        `insert into ${this.table} (id, tenant_id, data) values ($1, $2, $3)
         on conflict (id) do update set data = excluded.data, tenant_id = excluded.tenant_id`,
        [row.id, row.tenantId, JSON.stringify(row)],
      ),
    );
    return row;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    await this.ensure();
    // No tenant in the signature: take it from the request-scoped store so the
    // RLS GUC is set. Services always operate within their own tenant, so this
    // matches the row being patched; a missing tenant fails closed under RLS.
    const tenantId = currentTenantId();
    return withTenantTx(tenantId, async (c) => {
      const existingRows = await c.query<{ data: T }>(
        `select data from ${this.table} where id = $1`,
        [id],
      );
      const existing = existingRows.rows[0]?.data;
      if (!existing) throw new Error(`${this.name}: row not found: ${id}`);
      const next = { ...existing, ...patch, id: existing.id, tenantId: existing.tenantId };
      await c.query(`update ${this.table} set data = $2 where id = $1`, [
        id,
        JSON.stringify(next),
      ]);
      return next;
    });
  }

  async get(tenantId: string, id: string): Promise<T | undefined> {
    await this.ensure();
    const res = await withTenantTx(tenantId, (c) =>
      c.query<{ data: T }>(
        `select data from ${this.table} where id = $1 and tenant_id = $2`,
        [id, tenantId],
      ),
    );
    return res.rows[0]?.data;
  }

  async list(tenantId: string, predicate?: (row: T) => boolean): Promise<T[]> {
    await this.ensure();
    const res = await withTenantTx(tenantId, (c) =>
      c.query<{ data: T }>(`select data from ${this.table} where tenant_id = $1`, [tenantId]),
    );
    const out = res.rows.map((r) => r.data);
    return predicate ? out.filter(predicate) : out;
  }

  async find(tenantId: string, predicate: (row: T) => boolean): Promise<T | undefined> {
    return (await this.list(tenantId, predicate))[0];
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    await this.ensure();
    const res = await withTenantTx(tenantId, (c) =>
      c.query(`delete from ${this.table} where id = $1 and tenant_id = $2`, [id, tenantId]),
    );
    return (res.rowCount ?? 0) > 0;
  }

  async clear(): Promise<void> {
    await this.ensure();
    // Dev/test affordance. Under RLS (no tenant GUC) this is a no-op by design;
    // production data is never cleared through the runtime.
    await getDb().query(`delete from ${this.table}`);
  }
}
