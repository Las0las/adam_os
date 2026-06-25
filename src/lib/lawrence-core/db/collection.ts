// A tenant-scoped in-memory collection. This is the seam where a real
// Postgres/Supabase repository would slot in: every query is tenant-filtered
// by construction so the §47 "every row tenant-scoped" rule cannot be bypassed.

export interface TenantScoped {
  id: string;
  tenantId: string;
}

export class Collection<T extends TenantScoped> {
  private readonly rows = new Map<string, T>();

  constructor(public readonly name: string) {}

  insert(row: T): T {
    this.rows.set(row.id, row);
    return row;
  }

  update(id: string, patch: Partial<T>): T {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`${this.name}: row not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id, tenantId: existing.tenantId };
    this.rows.set(id, next);
    return next;
  }

  get(tenantId: string, id: string): T | undefined {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : undefined;
  }

  /** Always tenant-scoped; optional predicate narrows further. */
  list(tenantId: string, predicate?: (row: T) => boolean): T[] {
    const out: T[] = [];
    for (const row of this.rows.values()) {
      if (row.tenantId !== tenantId) continue;
      if (predicate && !predicate(row)) continue;
      out.push(row);
    }
    return out;
  }

  find(tenantId: string, predicate: (row: T) => boolean): T | undefined {
    return this.list(tenantId, predicate)[0];
  }

  delete(tenantId: string, id: string): boolean {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return false;
    return this.rows.delete(id);
  }

  clear(): void {
    this.rows.clear();
  }
}
