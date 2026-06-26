// Phase 6 — Mission Control hardening domain model (§38–§39 hardened). The
// governance + deployment control plane: environments, release bundles with
// items, approval requests, runtime components, kill switches, health checks,
// and rollback records. Every object is tenant-scoped (extends TenantScoped via
// the `id`/`tenantId` shape) so the Collection contract enforces isolation.

import type { RuntimeIncident } from "@/types/mission-control";

export type EnvironmentType = "dev" | "staging" | "prod";
export type EnvironmentStatus = "active" | "inactive" | "locked";

export type ReleaseStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "promoted"
  | "rolled_back"
  | "failed";

export type ReleaseType =
  | "pipeline"
  | "function"
  | "agent"
  | "action"
  | "config"
  | "domain_pack"
  | "mixed";

export type ReleaseItemType =
  | "pipeline"
  | "function"
  | "agent"
  | "action"
  | "prompt"
  | "model"
  | "notification_rule"
  | "domain_pack"
  | "config";

export type ReleaseItemChangeType = "create" | "update" | "delete" | "enable" | "disable";

export type ApprovalSubjectType =
  | "release_bundle"
  | "action_execution"
  | "rollback"
  | "kill_switch";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type RuntimeComponentType =
  | "pipeline"
  | "function"
  | "agent"
  | "action"
  | "notification_rule"
  | "model"
  | "integration";

export type RuntimeComponentStatus = "enabled" | "disabled" | "degraded" | "failed";

export type HealthStatus = "healthy" | "degraded" | "failed" | "unknown";

export type RollbackStatus =
  | "requested"
  | "pending_approval"
  | "approved"
  | "completed"
  | "failed"
  | "rejected";

export interface Environment {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  environmentType: EnvironmentType;
  status: EnvironmentStatus;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface ReleaseBundle {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description?: string | null;
  status: ReleaseStatus;
  releaseType: ReleaseType;
  sourceEnvironmentId?: string | null;
  targetEnvironmentId?: string | null;
  payload: Record<string, unknown>;
  createdBy?: string | null;
  approvedBy?: string | null;
  promotedBy?: string | null;
  rollbackOfReleaseId?: string | null;
  /** Validation snapshot captured at submit time (blockers/warnings). */
  validation?: { valid: boolean; blockers: string[]; warnings: string[] } | null;
  createdAt: string;
  approvedAt?: string | null;
  promotedAt?: string | null;
  rolledBackAt?: string | null;
}

export interface ReleaseBundleItem {
  id: string;
  tenantId: string;
  releaseBundleId: string;
  itemType: ReleaseItemType;
  itemId?: string | null;
  itemKey?: string | null;
  itemVersion?: number | null;
  changeType: ReleaseItemChangeType;
  payload: Record<string, unknown>;
  /** Prior runtime-component snapshot, captured at promote for reversal. */
  previousSnapshot?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  policyId?: string | null;
  status: ApprovalStatus;
  requestedBy?: string | null;
  assignedTo?: string | null;
  reason?: string | null;
  decisionNote?: string | null;
  decidedBy?: string | null;
  createdAt: string;
  decidedAt?: string | null;
}

export interface RuntimeComponent {
  id: string;
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  componentId?: string | null;
  environmentId?: string | null;
  status: RuntimeComponentStatus;
  version?: number | null;
  config: Record<string, unknown>;
  lastHealthStatus?: HealthStatus | null;
  lastHealthCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KillSwitch {
  id: string;
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
  enabled: boolean;
  reason?: string | null;
  enabledBy?: string | null;
  disabledBy?: string | null;
  enabledAt?: string | null;
  disabledAt?: string | null;
  createdAt: string;
}

export interface RuntimeHealthCheck {
  id: string;
  tenantId: string;
  environmentId?: string | null;
  componentType: RuntimeComponentType;
  componentKey: string;
  status: HealthStatus;
  latencyMs?: number | null;
  message?: string | null;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface RollbackRecord {
  id: string;
  tenantId: string;
  releaseBundleId: string;
  rollbackReleaseBundleId?: string | null;
  reason: string;
  status: RollbackStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
  completedBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface MissionControlOverview {
  environments: Environment[];
  releases: ReleaseBundle[];
  pendingApprovals: ApprovalRequest[];
  runtimeComponents: RuntimeComponent[];
  activeKillSwitches: KillSwitch[];
  recentHealthChecks: RuntimeHealthCheck[];
  runtimeIncidents: RuntimeIncident[];
  metrics: {
    pendingApprovals: number;
    promotedReleases24h: number;
    failedReleases7d: number;
    activeKillSwitches: number;
    degradedComponents: number;
    failedComponents: number;
  };
}
