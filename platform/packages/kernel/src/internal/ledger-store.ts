/**
 * INTERNAL — kernel-private. The append-only audit ledger that backs the kernel's
 * "guarantee audit" responsibility. Every decision — grant OR deny — yields one
 * immutable record here. It is NOT part of the public surface: no package outside
 * @lawrence/kernel may import from "@lawrence/kernel/internal/*" or this file. The
 * protected architectural test (packages/workspace) and dependency-cruiser enforce
 * this. A consumer that needs ledger data goes through the governed kernel audit
 * query — never the raw store.
 */
import type { AuditQuery, AuditRecord } from "@lawrence/contracts";

export class AuditLedger {
  private readonly records: AuditRecord[] = [];

  /** Append-only: callers can neither mutate nor delete existing records. */
  append(record: AuditRecord): AuditRecord {
    const frozen = Object.freeze({ ...record });
    this.records.push(frozen);
    return frozen;
  }

  query(filter: AuditQuery = {}): readonly AuditRecord[] {
    return this.records.filter((r) => {
      if (filter.principalId && r.principalId !== filter.principalId) return false;
      if (filter.decisionId && r.decisionId !== filter.decisionId) return false;
      if (filter.outcome && r.outcome !== filter.outcome) return false;
      if (filter.since && r.recordedAt < filter.since) return false;
      if (filter.until && r.recordedAt > filter.until) return false;
      return true;
    });
  }

  count(): number {
    return this.records.length;
  }
}
