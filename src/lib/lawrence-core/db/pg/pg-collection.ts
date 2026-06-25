// Postgres backend for a Collection (Phase 3). Each collection is a jsonb
// document table `rt_<name> (id text pk, tenant_id text, data jsonb)`. This
// mirrors the in-memory Collection semantics exactly — the whole row is stored
// as `data`, tenant scoping is enforced in SQL, and JS predicates filter the
// returned rows — so services behave identically across both backends. The
// canonical relational schema (db/migrations/0001–0010) is a separate reference
// model; these rt_* tables are the runtime's own persistence and coexist with it.

import { getDb } from "./client";
import type { Collection, TenantScoped } from "../collection";

export class PgCollection<T extends TenantScoped> implements Collection<T> {
  private readonly table: string;
  private ready: Promise<void> | null = null;

  constructor(public readonly name: string) {
    this.table = `rt_${name}`;
  }

  private ensure(): Promise<void> {
    if (!this.ready) {
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
    await getDb().query(
      `insert into ${this.table} (id, tenant_id, data) values ($1, $2, $3)
       on conflict (id) do update set data = excluded.data, tenant_id = excluded.tenant_id`,
      [row.id, row.tenantId, JSON.stringify(row)],
    );
    return row;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    await this.ensure();
    const existing = await this.getById(id);
    if (!existing) throw new Error(`${this.name}: row not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id, tenantId: existing.tenantId };
    await getDb().query(`update ${this.table} set data = $2 where id = $1`, [
      id,
      JSON.stringify(next),
    ]);
    return next;
  }

  async get(tenantId: string, id: string): Promise<T | undefined> {
    await this.ensure();
    const rows = await getDb().query<{ data: T }>(
      `select data from ${this.table} where id = $1 and tenant_id = $2`,
      [id, tenantId],
    );
    return rows.rows[0]?.data;
  }

  async list(tenantId: string, predicate?: (row: T) => boolean): Promise<T[]> {
    await this.ensure();
    const rows = await getDb().query<{ data: T }>(
      `select data from ${this.table} where tenant_id = $1`,
      [tenantId],
    );
    const out = rows.rows.map((r) => r.data);
    return predicate ? out.filter(predicate) : out;
  }

  async find(tenantId: string, predicate: (row: T) => boolean): Promise<T | undefined> {
    return (await this.list(tenantId, predicate))[0];
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    await this.ensure();
    const res = await getDb().query(
      `delete from ${this.table} where id = $1 and tenant_id = $2`,
      [id, tenantId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async clear(): Promise<void> {
    await this.ensure();
    await getDb().query(`delete from ${this.table}`);
  }

  private async getById(id: string): Promise<T | undefined> {
    const rows = await getDb().query<{ data: T }>(
      `select data from ${this.table} where id = $1`,
      [id],
    );
    return rows.rows[0]?.data;
  }
}
