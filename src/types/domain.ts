// LAWRENCE business domain seed packs. See spec §8–§13, §49–§53.

// ── Recruiting pack (§9) ────────────────────────────────────────────────
export type JobPriority = "A" | "B" | "C" | "D";
export type CandidateStage =
  | "new"
  | "screen"
  | "submitted"
  | "interview"
  | "offer"
  | "placed"
  | "rejected";

export interface Job {
  id: string;
  tenantId: string;
  clientId?: string | null;
  title: string;
  status: "open" | "on_hold" | "closed";
  priority: JobPriority;
  location?: string | null;
  compensation?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Candidate {
  id: string;
  tenantId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Submission {
  id: string;
  tenantId: string;
  candidateId: string;
  jobId: string;
  stage: CandidateStage;
  score?: number | null;
  rationale?: string | null;
  createdAt: string;
}

// ── Onboarding pack (§10) ───────────────────────────────────────────────
export interface OnboardingCase {
  id: string;
  tenantId: string;
  candidateId?: string | null;
  jobId?: string | null;
  accountId?: string | null;
  status: "draft" | "in_progress" | "blocked" | "ready" | "complete";
  startDate?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OnboardingTask {
  id: string;
  tenantId: string;
  caseId: string;
  ownerUserId?: string | null;
  title: string;
  status: "open" | "in_progress" | "blocked" | "done";
  dueAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Support pack (§11) ──────────────────────────────────────────────────
export interface SupportTicket {
  id: string;
  tenantId: string;
  subject: string;
  description?: string | null;
  status: "open" | "triaged" | "pending" | "resolved" | "closed";
  priority?: "p1" | "p2" | "p3" | "p4";
  assigneeUserId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  title: string;
  body?: string | null;
  sourceAssetId?: string | null;
  createdAt: string;
}

// ── Claims / validation pack (§12) ──────────────────────────────────────
export interface ValidationCase {
  id: string;
  tenantId: string;
  caseType: "claim_validation" | "contract_validation" | "invoice_validation";
  subjectObjectType: string;
  subjectObjectId: string;
  status: "open" | "in_review" | "validated" | "failed" | "needs_review";
  score?: number | null;
  summary?: string | null;
  createdAt: string;
}

export interface ValidationFinding {
  id: string;
  tenantId: string;
  validationCaseId: string;
  severity: "low" | "medium" | "high" | "critical";
  findingType: string;
  message: string;
  evidenceRefs: Record<string, unknown>[];
  createdAt: string;
}

// ── Executive / commercial ops pack (§13) ───────────────────────────────
export interface Account {
  id: string;
  tenantId: string;
  name: string;
  status?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  accountId?: string | null;
  name: string;
  stage: string;
  value?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RiskSignal {
  id: string;
  tenantId: string;
  objectType: string;
  objectId: string;
  riskType: string;
  severity: "low" | "medium" | "high" | "critical";
  rationale?: string | null;
  createdAt: string;
}
