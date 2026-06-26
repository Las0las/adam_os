// Phase 10 — compliance + retention contracts.

export type ComplianceExportType =
  | "audit"
  | "access"
  | "data_map"
  | "ai_usage"
  | "retention"
  | "security"
  | "full_evidence";

export interface ComplianceExport {
  id: string;
  tenantId: string;
  exportType: ComplianceExportType;
  status: "queued" | "running" | "completed" | "failed";
  requestedBy?: string | null;
  parameters: Record<string, unknown>;
  storagePath?: string | null;
  checksumSha256?: string | null;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export type RetentionAction = "archive" | "redact" | "delete" | "review";

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  objectType: string;
  retentionDays: number;
  action: RetentionAction;
  status: "active" | "inactive";
  config: Record<string, unknown>;
  createdAt: string;
}

export interface RetentionJob {
  id: string;
  tenantId: string;
  retentionPolicyId?: string | null;
  status: "queued" | "running" | "completed" | "failed" | "blocked";
  affectedCount: number;
  result: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
