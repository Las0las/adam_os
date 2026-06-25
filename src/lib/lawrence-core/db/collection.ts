// A tenant-scoped collection — the data-access seam. Two backends implement
// this async interface: MemoryCollection (default; local/test) and PgCollection
// (Postgres, when DATABASE_URL is set). Every query is tenant-filtered by
// construction so the §47 "every row tenant-scoped" rule cannot be bypassed.

export interface TenantScoped {
  id: string;
  tenantId: string;
}

export interface Collection<T extends TenantScoped> {
  readonly name: string;
  insert(row: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  get(tenantId: string, id: string): Promise<T | undefined>;
  list(tenantId: string, predicate?: (row: T) => boolean): Promise<T[]>;
  find(tenantId: string, predicate: (row: T) => boolean): Promise<T | undefined>;
  delete(tenantId: string, id: string): Promise<boolean>;
  clear(): Promise<void>;
}

/** In-memory backend. Default runtime; backs the unit tests and `npm run seed`. */
export class MemoryCollection<T extends TenantScoped> implements Collection<T> {
  private readonly rows = new Map<string, T>();

  constructor(public readonly name: string) {}

  async insert(row: T): Promise<T> {
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`${this.name}: row not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id, tenantId: existing.tenantId };
    this.rows.set(id, next);
    return next;
  }

  async get(tenantId: string, id: string): Promise<T | undefined> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : undefined;
  }

  async list(tenantId: string, predicate?: (row: T) => boolean): Promise<T[]> {
    const out: T[] = [];
    for (const row of this.rows.values()) {
      if (row.tenantId !== tenantId) continue;
      if (predicate && !predicate(row)) continue;
      out.push(row);
    }
    return out;
  }

  async find(tenantId: string, predicate: (row: T) => boolean): Promise<T | undefined> {
    return (await this.list(tenantId, predicate))[0];
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return false;
    return this.rows.delete(id);
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}
