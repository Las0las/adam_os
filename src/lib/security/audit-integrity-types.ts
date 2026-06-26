// Phase 10 — audit integrity contracts.

export interface AuditIntegrityCheck {
  id: string;
  tenantId: string;
  status: "passed" | "failed";
  checkedFrom?: string | null;
  checkedTo?: string | null;
  failureEventId?: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditChainResult {
  ok: boolean;
  eventsChecked: number;
  failureEventId?: string | null;
  reason?: string;
}
