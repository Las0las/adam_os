// Phase 8 — Healthcare Ops domain pack (net-new; carries its own demo objects +
// evidence, reuses the platform's grounded answer function).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const healthcareOpsPack: DomainPackManifest = {
  key: "healthcare_ops",
  name: "Healthcare Ops Pack",
  version: "1.0.0",
  category: "healthcare",
  description: "Care gap summaries, authorization risk detection, and compliance evidence review.",
  objectTypes: ["PatientCase", "Provider", "Referral", "Authorization", "CareGap", "ComplianceFinding"],
  linkTypes: ["referral_of_patient", "authorization_of_referral"],
  functions: ["answer_with_citations", "recommend_next_action"],
  agents: [],
  actions: [],
  notificationRules: [
    { name: "Healthcare authorization risk", eventKey: "healthcare.authorization_risk", channel: "in_app", template: "Referral {{subjectId}} is missing authorization — compliance risk." },
  ],
  evalSuites: [
    { key: "healthcare_authorization_risk_eval", name: "Authorization risk retrieval", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "referral missing authorization", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "healthcare_compliance_finding_eval", name: "Compliance finding response", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "Is the referral missing authorization?", objectTypes: ["Referral"] }, expected: {} }] },
  ],
  demoScenarios: [
    {
      key: "referral-authorization-risk",
      packKey: "healthcare_ops",
      name: "Referral Authorization Risk",
      description: "Detect a referral missing authorization and create a compliance finding/review.",
      persona: "operator",
      estimatedMinutes: 5,
      steps: [
        { key: "install", title: "Install Healthcare Ops Pack", description: "Install runtime + patient/referral objects.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed; demo objects created." },
        { key: "objects", title: "Seed patient + referral", description: "Referral missing authorization.", action: "create_demo_objects", payload: {}, expectedOutcome: "Patient/referral/authorization objects exist." },
        { key: "risk", title: "Run authorization risk", description: "Grounded answer over referral evidence.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "Is the referral missing authorization?", objectTypes: ["Referral"] } }, expectedOutcome: "Grounded authorization risk answer + trace." },
        { key: "evals", title: "Run pack evals", description: "Authorization + compliance evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "Care gap + authorization risk queue.", action: "open_command_center", payload: {}, expectedOutcome: "Demo healthcare work visible." },
      ],
    },
  ],
  sampleObjects: [
    { objectType: "PatientCase", externalKey: "demo-patient-1", title: "Patient Case — J. Rivera", properties: { riskLevel: "elevated" }, evidence: ["Patient J. Rivera has an open cardiology referral with no authorization on file. Care gap: overdue follow-up."] },
    { objectType: "Referral", externalKey: "demo-referral-1", title: "Cardiology Referral", status: "open", properties: { specialty: "cardiology", authorizationOnFile: false }, evidence: ["Cardiology referral submitted 2026-06-20. No prior authorization attached. Compliance requires authorization before scheduling."] },
    { objectType: "Authorization", externalKey: "demo-auth-1", title: "Authorization (missing)", status: "missing", properties: { referralKey: "demo-referral-1" }, evidence: ["No authorization record exists for the cardiology referral. This is an authorization risk and a compliance finding candidate."] },
  ],
  businessValue: "Prevents non-compliant care delivery by catching missing authorizations and care gaps with evidence.",
  implementationRoadmap: ["Connect EHR", "Map patient/referral ontology", "Enable authorization + care gap checks", "Tune compliance review"],
  requiredIntegrations: ["EHR", "Authorization system"],
  dataRequired: ["Patient cases", "Referrals", "Authorizations"],
  governanceControls: ["Compliance review", "Evidence-linked findings", "Audit"],
  successMetrics: ["Authorization gap rate", "Care gap closure time", "Compliance findings resolved"],
};

registerDomainPack(healthcareOpsPack);
