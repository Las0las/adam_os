// LAWRENCE Mission Control domain model. See spec §7.7, §34–§39.

export interface ActionDefinition {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  objectType?: string | null;
  inputSchema: Record<string, unknown>;
  approvalPolicyId?: string | null;
  /** Required permission to execute this action (§47). */
  requiredPermission?: string | null;
  createdAt: string;
}

export interface ActionExecution {
  id: string;
  tenantId: string;
  actionId: string;
  objectType?: string | null;
  objectId?: string | null;
  input: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  // "blocked" = policy/precondition/permission failure (fail-closed).
  // "awaiting_approval" = human approval gate (not a failure).
  status: "queued" | "running" | "completed" | "failed" | "blocked" | "awaiting_approval";
  /** Idempotency key — re-executing with the same key returns the prior result. */
  idempotencyKey?: string | null;
  blockedReason?: string | null;
  reviewCaseId?: string | null;
  createdAt: string;
}

export interface ReviewCase {
  id: string;
  tenantId: string;
  caseType: string;
  subjectObjectType?: string | null;
  subjectObjectId?: string | null;
  status: "open" | "in_review" | "approved" | "rejected" | "resolved";
  severity?: "low" | "medium" | "high" | "critical";
  summary?: string | null;
  /** Optional action this review gates; approval releases it. */
  gatedActionExecutionId?: string | null;
  assigneeUserId?: string | null;
  createdAt: string;
}

export interface ReviewCaseEvent {
  id: string;
  tenantId: string;
  reviewCaseId: string;
  actorUserId?: string | null;
  kind: "created" | "assigned" | "comment" | "approved" | "rejected" | "resolved";
  note?: string | null;
  createdAt: string;
}

export type NotificationChannel = "in_app" | "email" | "slack" | "teams" | "webhook";

export interface NotificationRule {
  id: string;
  tenantId: string;
  name: string;
  /** Event key that triggers the rule, e.g. "review_case.created". */
  eventKey: string;
  channel: NotificationChannel;
  /** Allowlisted external destination (§47 — required for non in_app channels). */
  destination?: string | null;
  recipientRole?: string | null;
  template: string;
  enabled: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  ruleId?: string | null;
  recipientUserId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  state: "queued" | "sent" | "failed" | "acknowledged";
  deepLink?: string | null;
  /** Dedupe key — duplicate sends within a window are suppressed. */
  dedupeKey?: string | null;
  error?: string | null;
  createdAt: string;
}

// §38 deployments / releases / runtime.
export type DeploymentEnvironment = "draft" | "staging" | "production";

export interface ReleaseBundle {
  id: string;
  tenantId: string;
  name: string;
  /** Object refs included in the release (functions / agents / pipelines). */
  artifacts: Array<{ kind: string; id: string; version: number }>;
  environment: DeploymentEnvironment;
  status: "draft" | "promoting" | "deployed" | "rolled_back";
  promotedFrom?: DeploymentEnvironment | null;
  createdAt: string;
}

export interface RuntimeIncident {
  id: string;
  tenantId: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved";
  source: string;
  detail?: string | null;
  createdAt: string;
}
