// Phase 5 — Command Center production data contract (Part A1). Everything the
// operating surface renders is normalized into CommandCenterItem and grouped
// into ranked queues.

export type CommandDomain =
  | "recruiting"
  | "onboarding"
  | "support"
  | "claims"
  | "executive"
  | "mission_control";

export type CommandSeverity = "low" | "medium" | "high" | "critical";

export type CommandItemStatus =
  | "open"
  | "in_progress"
  | "awaiting_review"
  | "awaiting_approval"
  | "blocked"
  | "completed"
  | "failed";

export type SurfaceMode = "recruiter" | "executive";

export interface CommandObjectRef {
  objectType: string;
  objectId: string;
  title?: string | null;
  href?: string | null;
}

export interface CommandEvidenceRef {
  objectType: string;
  objectId: string;
  chunkId?: string | null;
  excerpt?: string | null;
  score?: number | null;
  method?: string | null;
}

export interface CommandActionRef {
  actionKey: string;
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  requiresApproval?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  input?: Record<string, unknown>;
}

export interface CommandCenterItem {
  id: string;
  tenantId: string;
  domain: CommandDomain;
  kind: "action" | "review" | "risk" | "recommendation" | "notification" | "incident" | "audit" | "learning_signal";
  title: string;
  summary?: string | null;
  status: CommandItemStatus;
  severity?: CommandSeverity | null;
  priorityScore: number;
  objectRef?: CommandObjectRef | null;
  subjectRefs?: CommandObjectRef[];
  evidenceRefs?: CommandEvidenceRef[];
  actions?: CommandActionRef[];
  createdAt: string;
  updatedAt?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CommandCenterOverview {
  generatedAt: string;
  mode: SurfaceMode;
  metrics: {
    openActions: number;
    openReviews: number;
    criticalRisks: number;
    blockedWork: number;
    pendingApprovals: number;
    failedRuntimeItems: number;
  };
  actionQueue: CommandCenterItem[];
  reviewQueue: CommandCenterItem[];
  riskQueue: CommandCenterItem[];
  recommendationQueue: CommandCenterItem[];
  notificationQueue: CommandCenterItem[];
  incidentQueue: CommandCenterItem[];
  recentActivity: CommandCenterItem[];
}
