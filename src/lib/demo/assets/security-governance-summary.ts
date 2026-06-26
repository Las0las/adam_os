// Phase 8 — platform-wide security & governance summary (in-app implementation
// asset). Static, sourced from the real platform controls.

export interface GovernanceSummary {
  title: string;
  points: Array<{ heading: string; detail: string }>;
}

export const securityGovernanceSummary: GovernanceSummary = {
  title: "Security & Governance",
  points: [
    { heading: "Tenant isolation", detail: "Every record is tenant-scoped by construction; cross-tenant reads are impossible through the data-access seam." },
    { heading: "Permission guards", detail: "Privileged operations require explicit permissions; retrieval and write-backs never bypass them." },
    { heading: "Approval gates", detail: "Production releases, dangerous actions, rollbacks, and kill switches are policy-evaluated and fail-closed." },
    { heading: "Eval release gates", detail: "Quality-sensitive releases block on missing, failed, or regressed evals before reaching production." },
    { heading: "Kill switches", detail: "Any function/agent/action/pipeline can be disabled instantly with an audited reason." },
    { heading: "Full audit trail", detail: "Every state change — installs, runs, approvals, rollbacks, demo runs — emits an audit event." },
    { heading: "Grounded AI", detail: "Answers preserve citations to evidence; ungrounded or forbidden claims are caught by evals." },
    { heading: "Governed learning", detail: "Learning is captured as explicit, reviewable signals — no silent model changes or auto-promotion." },
  ],
};
