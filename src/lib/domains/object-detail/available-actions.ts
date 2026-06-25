// Phase 5 — available actions by object type/status (Part C3). Pure mapping used
// by both the Command Center and the Object Detail drawer. Each entry's input
// carries `runKind` so the UI routes it correctly:
//   "action"   → POST /api/mission-control/actions/:key/execute (governed)
//   "function" → POST /api/aiops/functions/:key/run (read-only AI run)
//   "review"   → POST /api/mission-control/review-cases/:id/resolve (decision)

import type { CommandActionRef } from "../command-center/command-center-types";

function action(
  actionKey: string,
  label: string,
  variant: CommandActionRef["variant"],
  extra: Partial<CommandActionRef> & { input?: Record<string, unknown> } = {},
): CommandActionRef {
  return {
    actionKey,
    label,
    variant,
    requiresApproval: extra.requiresApproval,
    disabled: extra.disabled,
    disabledReason: extra.disabledReason ?? null,
    input: { runKind: "action", ...(extra.input ?? {}) },
  };
}

const fn = (key: string, label: string, input: Record<string, unknown> = {}): CommandActionRef =>
  action(key, label, "ghost", { input: { ...input, runKind: "function" } });

const review = (decision: string, label: string, variant: CommandActionRef["variant"]): CommandActionRef =>
  action("resolve_review", label, variant, { input: { runKind: "review", decision } });

const BY_TYPE: Record<string, CommandActionRef[]> = {
  Candidate: [
    fn("recruiting.candidate_fit_summary", "Run Fit Summary"),
    action("recruiting.create_recruiter_note", "Create Recruiter Note", "secondary"),
    action("recruiting.shortlist_candidate", "Shortlist Candidate", "primary", { requiresApproval: true }),
    action("create_review_case", "Request Review", "ghost", {
      input: { caseType: "recruiting.candidate_fit_review" },
    }),
  ],
  Job: [
    action("create_review_case", "Create Review Case", "ghost"),
    action("noop.market_brief", "Run Role Brief", "ghost", {
      disabled: true,
      disabledReason: "Market brief function not yet available",
    }),
  ],
  OnboardingCase: [
    fn("onboarding.readiness_summary", "Run Readiness Summary"),
    action("onboarding.notify_owner", "Notify Owners", "secondary"),
    action("onboarding.create_task", "Create Task", "secondary"),
  ],
  SupportTicket: [
    fn("support.answer_with_citations", "Draft Answer"),
    action("support.create_draft_response", "Create Draft", "primary"),
    action("create_review_case", "Request Review", "ghost"),
  ],
  ValidationCase: [
    fn("claims.validation_case_evidence_summary", "Run Validation Summary"),
    action("claims.create_validation_finding", "Create Finding", "secondary"),
    action("create_review_case", "Request More Evidence", "ghost"),
  ],
  Account: [
    fn("executive.account_risk_brief", "Run Risk Brief"),
    action("executive.create_decision_memo", "Create Decision Memo", "primary"),
    action("create_notification", "Notify Executive", "secondary"),
  ],
  RiskSignal: [
    action("create_review_case", "Create Review Case", "ghost"),
    action("update_ontology_object", "Dismiss Risk", "danger", {
      requiresApproval: true,
      input: { status: "dismissed" },
    }),
    action("create_review_case", "Escalate", "secondary", { input: { severity: "high" } }),
  ],
  ReviewCase: [
    review("approved", "Approve", "primary"),
    review("rejected", "Reject", "danger"),
    review("request_changes", "Request Changes", "secondary"),
    review("escalate", "Escalate", "ghost"),
  ],
};

/** Governed actions available for an object type (status-aware where relevant). */
export function availableActionsForObject(objectType: string, _status?: string | null): CommandActionRef[] {
  return (BY_TYPE[objectType] ?? []).map((a) => ({ ...a, input: { ...a.input } }));
}

export function hasActionsForType(objectType: string): boolean {
  return Boolean(BY_TYPE[objectType]);
}
