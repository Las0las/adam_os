// Phase 7 — closed-loop learning domain model. Learning is captured as explicit,
// auditable records (feedback, recommendation outcomes, learning signals) — never
// as silent model writes. Signals require human review and never auto-promote.

export type FeedbackType =
  | "answer_rating"
  | "extraction_correction"
  | "recommendation_override"
  | "action_outcome"
  | "review_decision"
  | "citation_issue";

export interface HumanFeedback {
  id: string;
  tenantId: string;
  feedbackType: FeedbackType;
  subjectType: string;
  subjectId: string;
  objectType?: string | null;
  objectId?: string | null;
  rating?: number | null;
  label?: string | null;
  comment?: string | null;
  correction?: Record<string, unknown> | null;
  actorUserId?: string | null;
  createdAt: string;
}

export type OutcomeDecision =
  | "accepted"
  | "rejected"
  | "ignored"
  | "modified"
  | "escalated"
  | "expired";

export type OutcomeStatus = "successful" | "unsuccessful" | "unknown";

export interface RecommendationOutcome {
  id: string;
  tenantId: string;
  recommendationObjectId?: string | null;
  sourceRunType?: string | null;
  sourceRunId?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  recommendedActionKey?: string | null;
  decision: OutcomeDecision;
  outcomeStatus?: OutcomeStatus | null;
  rationale?: string | null;
  actorUserId?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export type LearningSignalType =
  | "retrieval_gap"
  | "prompt_gap"
  | "extraction_gap"
  | "policy_gap"
  | "ranking_signal"
  | "action_success"
  | "action_failure";

export type LearningSignalStatus = "open" | "reviewed" | "accepted" | "rejected" | "implemented";

export type LearningSignalSeverity = "low" | "medium" | "high" | "critical";

export interface LearningSignal {
  id: string;
  tenantId: string;
  signalType: LearningSignalType;
  componentType?: string | null;
  componentKey?: string | null;
  domain?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  severity: LearningSignalSeverity;
  summary: string;
  evidence: Array<Record<string, unknown>>;
  recommendedChange: Record<string, unknown>;
  status: LearningSignalStatus;
  createdFromFeedbackId?: string | null;
  createdFromEvalRunId?: string | null;
  /** Set when an accepted signal is linked to a release proposal/bundle. */
  linkedReleaseBundleId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}
