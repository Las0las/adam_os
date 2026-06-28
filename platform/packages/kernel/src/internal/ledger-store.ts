/**
 * INTERNAL — kernel-private. This module is the append-only ledger store that
 * backs the kernel's audit + commit responsibilities. It is NOT part of the
 * public surface: no package outside @lawrence/kernel may import from
 * "@lawrence/kernel/internal/*" or reach into this file. The protected
 * architectural test (packages/workspace) and dependency-cruiser both enforce
 * this. A projection/runtime/workspace that needs ledger data must go through
 * the governed Kernel.audit() query — never the raw store.
 */
import type { AuditQuery, AuditRecord } from "@lawrence/contracts";

const RECORDS: AuditRecord[] = [];

/** Append-only: callers cannot mutate or delete existing records. */
export function appendRecord(record: AuditRecord): void {
  RECORDS.push(Object.freeze({ ...record }));
}

export function queryRecords(_query: AuditQuery): readonly AuditRecord[] {
  return RECORDS.slice();
}

export function recordCount(): number {
  return RECORDS.length;
}
