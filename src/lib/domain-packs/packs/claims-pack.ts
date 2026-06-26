// Phase 8 — Claims domain pack (productized over the Phase 4 claims seed pack).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const claimsPack: DomainPackManifest = {
  key: "claims",
  name: "Claims Validation Pack",
  version: "1.0.0",
  category: "claims",
  description: "Email/attachment evidence validation, missing-evidence + contradiction detection, validator review routing.",
  objectTypes: ["ValidationCase", "ValidationFinding", "ClaimRecord", "EmailMessage", "EvidenceItem"],
  linkTypes: ["finding_of_case", "evidence_of_case"],
  seedPackKey: "claims",
  functions: ["claims.validation_case_evidence_summary", "answer_with_citations"],
  agents: ["claims.validation_agent"],
  actions: ["claims.create_validation_finding"],
  notificationRules: [],
  evalSuites: [
    { key: "claims_evidence_retrieval_eval", name: "Evidence retrieval", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "claim amount mismatch invoice", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "claims_finding_response_eval", name: "Finding evidence summary", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "Is there a claim amount mismatch?", objectTypes: ["ValidationCase"] }, expected: {} }] },
  ],
  demoScenarios: [
    {
      key: "email-attachment-validation",
      packKey: "claims",
      name: "Email + Attachment Evidence Validation",
      description: "Validate a claim with amount mismatch; create critical finding + validator review.",
      persona: "validator",
      estimatedMinutes: 6,
      steps: [
        { key: "install", title: "Install Claims Pack", description: "Install runtime + validation case.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed." },
        { key: "objects", title: "Seed validation case", description: "Claim with supporting email + attachment evidence.", action: "create_demo_objects", payload: {}, expectedOutcome: "Validation case + evidence exist." },
        { key: "summary", title: "Run evidence summary", description: "Grounded validation evidence summary.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "Is there a claim amount mismatch and what evidence supports it?", objectTypes: ["ValidationCase"] } }, expectedOutcome: "Grounded evidence summary + trace." },
        { key: "evals", title: "Run pack evals", description: "Evidence + finding evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "Critical finding + validator review.", action: "open_command_center", payload: {}, expectedOutcome: "Demo claims work visible." },
        { key: "audit", title: "Show audit trail", description: "Findings are evidence-linked + auditable.", action: "show_audit", payload: {}, expectedOutcome: "Audit shows finding provenance." },
      ],
    },
  ],
  sampleObjects: [],
  businessValue: "Reduces manual claim review and catches contradictions with evidence-linked findings.",
  implementationRoadmap: ["Connect claims intake", "Index email/attachments", "Enable validation + findings", "Tune review routing"],
  requiredIntegrations: ["Claims system", "Email/attachment store"],
  dataRequired: ["Claims", "Emails", "Attachments"],
  governanceControls: ["Critical-finding review", "Evidence-linked findings", "Audit"],
  successMetrics: ["Validation cycle time", "Missing evidence rate", "Contradiction rate", "Manual review rate"],
};

registerDomainPack(claimsPack);
