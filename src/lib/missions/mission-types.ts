// MS-010 — Mission Execution Runtime: types. The runtime is the canonical engine
// that executes enterprise missions AFTER the Governance Orchestrator (VS-008)
// approves execution. Generic infrastructure only — no business/recruiting logic.
// Deterministic; no AI planning.

import type { GovernanceDecision } from "@/lib/dataops/ontology/governance/governance-types";
import type { GovernanceEnforcementMode } from "@/lib/dataops/ontology/governance/governance-enforcement";
import type { OntologyGraph } from "@/lib/dataops/ontology/graph/graph-types";

export type MissionExecutionState =
  | "draft"
  | "ready"
  | "approved"
  | "running"
  | "waiting"
  | "blocked"
  | "failed"
  | "completed"
  | "cancelled";

export type TaskState =
  | "pending"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

/** Deterministic retry policy: total attempts including the first (no backoff). */
export interface RetryPolicy {
  maxAttempts: number;
}

export interface TaskDefinition {
  id: string;
  /** Key of a registered executor (Agent Dispatcher). */
  executor: string;
  /** Ids of tasks that must complete before this task runs. */
  dependsOn?: string[];
  input?: Record<string, unknown>;
  /** When true, the runtime pauses at this task until approval is granted. */
  requiresApproval?: boolean;
  retry?: RetryPolicy;
}

export interface MissionDefinition {
  id: string;
  name?: string;
  tasks: TaskDefinition[];
  /** Governance scope passed to evaluateGovernance(). */
  objectTypes?: string[];
}

export type MissionEventType =
  | "mission.started"
  | "mission.paused"
  | "mission.resumed"
  | "mission.task.started"
  | "mission.task.completed"
  | "mission.task.failed"
  | "mission.completed"
  | "mission.failed"
  | "mission.cancelled";

export interface MissionEvent {
  type: MissionEventType;
  missionId: string;
  executionId: string;
  taskId?: string;
  at: string;
  detail?: Record<string, unknown>;
}

export interface TaskExecutionRecord {
  id: string;
  executor: string;
  state: TaskState;
  dependsOn: string[];
  attempts: number;
  error?: string;
  output?: Record<string, unknown>;
}

export interface MissionExecutionReport {
  executionId: string;
  missionId: string;
  missionName?: string;
  executionState: MissionExecutionState;
  governance: {
    executionDecision: GovernanceDecision["executionDecision"];
    overallStatus: GovernanceDecision["overallStatus"];
    blocking: number;
    warnings: number;
  };
  tasks: TaskExecutionRecord[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    cancelled: number;
    waiting: number;
    pending: number;
    running: number;
  };
  pendingApprovals: string[];
  durationMs: number;
  retryStatistics: { totalAttempts: number; totalRetries: number };
  events: MissionEvent[];
  /** Subject id used for all audit events of this execution. */
  auditExecutionId: string;
}

/** Durable, tenant-scoped record of one mission execution (MS-011). The full
 *  report is retained verbatim for observability and audit traceability. */
export interface MissionExecutionRecord {
  /** Equals report.executionId. */
  id: string;
  tenantId: string;
  createdAt: string;
  report: MissionExecutionReport;
}

export interface ExecuteMissionOptions {
  /** Governance + runtime enforcement mode override (else resolved per tenant). */
  mode?: GovernanceEnforcementMode;
  /** Graph snapshot for governance (else the tenant graph is loaded). */
  graph?: OntologyGraph;
  /** Task ids whose approval checkpoints are granted for this run. */
  approvals?: string[] | Set<string>;
  /** Cooperative cancellation predicate, checked before each layer/task. */
  cancelled?: () => boolean;
}

export type { GovernanceEnforcementMode, OntologyGraph };
