// Phase 10 — local Security UI types. Declared locally so the client surface
// never imports from src/lib/security/** (backend-only). Shapes mirror the
// live API contract documented for Phase 10.

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export type FindingStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "accepted_risk";

export interface SecurityPosture {
  generatedAt: string;
  findings: {
    open: number;
    bySeverity: { low: number; medium: number; high: number; critical: number };
    criticalOpen: number;
  };
  auditIntegrity: { lastCheckPassed: boolean | null; checks: number };
  classifications: { total: number; byClassification: Record<string, number> };
  retention: { policies: number; jobs: number };
  complianceExports: { total: number; lastStatus: string | null };
}

export interface SecurityFinding {
  id: string;
  tenantId: string;
  severity: SecuritySeverity;
  findingType: string;
  title: string;
  summary?: string;
  objectType?: string;
  objectId?: string;
  status: FindingStatus;
  evidence: Array<Record<string, unknown>>;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditIntegrityCheck {
  id: string;
  status: "passed" | "failed";
  checkedFrom?: string;
  checkedTo?: string;
  failureEventId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditVerifyResult {
  result: {
    ok: boolean;
    eventsChecked: number;
    failureEventId?: string;
    reason?: string;
  };
  check: AuditIntegrityCheck;
}

export type AclPrincipalType = "user" | "group" | "role";
export type AclPermission = "read" | "write" | "approve" | "execute" | "admin";
export type AclEffect = "allow" | "deny";

export interface ObjectAclEntry {
  id: string;
  objectType: string;
  objectId: string;
  principalType: AclPrincipalType;
  principalId: string;
  permission: AclPermission;
  effect: AclEffect;
  createdAt?: string;
}

export interface AccessDecision {
  allowed: boolean;
  effect: string;
  reason: string;
  redactions?: unknown;
  requiredApproval?: unknown;
}

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "pii"
  | "financial"
  | "legal"
  | "health"
  | "restricted"
  | "credential";

export interface DataClassificationRecord {
  id: string;
  objectType: string;
  objectId: string;
  fieldPath?: string;
  classification: DataClassification;
  source?: string;
  confidence?: number;
  createdAt?: string;
}

export interface ClassificationLookup {
  effective: DataClassification | null;
  records: DataClassificationRecord[];
}

export type RetentionAction = "archive" | "redact" | "delete" | "review";

export interface RetentionPolicy {
  id: string;
  key: string;
  name: string;
  objectType: string;
  retentionDays: number;
  action: RetentionAction;
  status: string;
  createdAt: string;
}

export interface RetentionJob {
  id: string;
  status: string;
  affectedCount: number;
  result: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface RetentionData {
  policies: RetentionPolicy[];
  jobs: RetentionJob[];
}

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
  exportType: string;
  status: string;
  requestedBy?: string;
  checksumSha256?: string;
  storagePath?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ComplianceExportBundle {
  export: ComplianceExport;
  bundle: unknown;
}

export interface SecretScanResult {
  scanned: number;
  secretsFound: number;
  findings: SecurityFinding[];
}

export interface HarnessProbe {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface HarnessResult {
  generatedAt: string;
  passed: boolean;
  probeCount: number;
  failedCount: number;
  probes: HarnessProbe[];
}
