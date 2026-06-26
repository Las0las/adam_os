// Phase 8 — Recruiting domain pack (productized over the Phase 4 recruiting seed
// pack). Demo runs real services: install → seed objects → grounded function run
// → evals, with governed workflows available in Command Center.

import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const recruitingPack: DomainPackManifest = {
  key: "recruiting",
  name: "Recruiting Pack",
  version: "1.0.0",
  category: "recruiting",
  description: "Evidence-backed candidate fit, shortlist building, and governed recruiter actions.",
  objectTypes: ["Job", "Candidate", "Submission", "RecruiterNote", "ShortlistDecision"],
  linkTypes: ["candidate_for_job", "submission_of_candidate"],
  seedPackKey: "recruiting",
  functions: ["recruiting.candidate_fit_summary", "answer_with_citations"],
  agents: ["recruiting.shortlist_builder"],
  actions: ["recruiting.create_recruiter_note"],
  notificationRules: [],
  evalSuites: [
    {
      key: "recruiting_candidate_fit_retrieval_eval",
      name: "Candidate fit retrieval",
      suiteType: "retrieval",
      targetComponentKey: "answer_with_citations",
      baselineScore: 0.1,
      cases: [
        { input: { query: "Power BI Fabric healthcare experience", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } },
      ],
    },
    {
      key: "recruiting_fit_summary_response_eval",
      name: "Fit summary grounded response",
      suiteType: "response",
      targetComponentKey: "answer_with_citations",
      baselineScore: 0.1,
      cases: [
        { input: { functionKey: "answer_with_citations", question: "Does the candidate have Power BI experience?", objectTypes: ["Candidate"] }, expected: { forbiddenClaims: ["guaranteed"] } },
      ],
    },
  ],
  demoScenarios: [
    {
      key: "hot-job-to-shortlist",
      packKey: "recruiting",
      name: "From Hot Job to Governed Shortlist",
      description: "Install the pack, ground candidate evidence, run a fit summary, and route weak evidence to review.",
      persona: "recruiter",
      estimatedMinutes: 6,
      steps: [
        { key: "install", title: "Install Recruiting Pack", description: "Install pack objects, functions, agents, actions, evals.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed; demo objects created." },
        { key: "objects", title: "Create demo candidates + job", description: "Seed Sr. Power BI Developer role and candidates with resume evidence.", action: "create_demo_objects", payload: {}, expectedOutcome: "Demo job + candidates with evidence exist." },
        { key: "fit", title: "Run grounded candidate fit", description: "Answer with citations over candidate evidence.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "Which candidate has Power BI healthcare experience?", objectTypes: ["Candidate"] } }, expectedOutcome: "Grounded answer with citations + runtime trace." },
        { key: "evals", title: "Run pack evals", description: "Run retrieval + response evals for release-gate readiness.", action: "run_evals", payload: {}, expectedOutcome: "Eval runs with scores; regression visible if present." },
        { key: "cc", title: "Open Command Center", description: "See the recommendation/review queue in demo mode.", action: "open_command_center", payload: {}, expectedOutcome: "Command Center shows demo recruiting work." },
        { key: "audit", title: "Show audit trail", description: "Every step is audited and traceable.", action: "show_audit", payload: {}, expectedOutcome: "Audit trail explains what happened and who acted." },
      ],
    },
  ],
  sampleObjects: [],
  businessValue: "Cuts manual screening time and enforces an evidence-backed, auditable shortlist.",
  implementationRoadmap: ["Connect ATS source", "Map Candidate/Job ontology", "Enable fit + shortlist workflows", "Tune evals + approval policies"],
  requiredIntegrations: ["ATS / resume source", "Email/Slack for HM notifications"],
  dataRequired: ["Jobs", "Candidates", "Resumes / submission evidence"],
  governanceControls: ["Approval-gated recruiter actions", "Review queue for weak evidence", "Audit trail", "Eval release gates"],
  successMetrics: ["Time to shortlist", "Submission quality", "Interview conversion", "Evidence coverage", "Review override rate"],
};

registerDomainPack(recruitingPack);
