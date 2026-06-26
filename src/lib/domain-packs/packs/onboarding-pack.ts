// Phase 8 — Onboarding domain pack (productized over the Phase 4 onboarding seed pack).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const onboardingPack: DomainPackManifest = {
  key: "onboarding",
  name: "Onboarding Pack",
  version: "1.0.0",
  category: "onboarding",
  description: "Day-1 readiness detection, blocker escalation, and owner accountability.",
  objectTypes: ["OnboardingCase", "OnboardingTask", "CredentialRequest", "EquipmentRequest", "DayOnePlan"],
  linkTypes: ["task_of_case"],
  seedPackKey: "onboarding",
  functions: ["onboarding.readiness_summary", "answer_with_citations"],
  agents: ["onboarding.blocker_escalation"],
  actions: ["onboarding.notify_owner", "onboarding.create_task"],
  notificationRules: [],
  evalSuites: [
    { key: "onboarding_blocker_detection_eval", name: "Blocker detection", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "missing credentials equipment blocker", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "onboarding_owner_recommendation_eval", name: "Owner action recommendation", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "What blockers exist for day-1 readiness?", objectTypes: ["OnboardingCase"] }, expected: {} }] },
  ],
  demoScenarios: [
    {
      key: "day1-readiness",
      packKey: "onboarding",
      name: "Day-1 Readiness Without Spreadsheet Chaos",
      description: "Detect missing credentials/equipment and escalate to owners before start date.",
      persona: "operator",
      estimatedMinutes: 6,
      steps: [
        { key: "install", title: "Install Onboarding Pack", description: "Install pack runtime + demo cases.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed." },
        { key: "objects", title: "Seed onboarding case", description: "New hire starting in 3 days with missing items.", action: "create_demo_objects", payload: {}, expectedOutcome: "Onboarding case + tasks exist." },
        { key: "readiness", title: "Run readiness summary", description: "Grounded readiness answer over case evidence.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "What is blocking day-1 readiness?", objectTypes: ["OnboardingCase"] } }, expectedOutcome: "Grounded readiness summary + trace." },
        { key: "evals", title: "Run pack evals", description: "Blocker + recommendation evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "See escalations + review case.", action: "open_command_center", payload: {}, expectedOutcome: "Demo onboarding work visible." },
        { key: "audit", title: "Show audit trail", description: "Owner actions are auditable.", action: "show_audit", payload: {}, expectedOutcome: "Audit explains escalations." },
      ],
    },
  ],
  sampleObjects: [],
  businessValue: "Prevents day-1 failures by catching missing items early and holding owners accountable.",
  implementationRoadmap: ["Connect HRIS", "Map onboarding ontology", "Enable readiness + escalation", "Tune owner notifications"],
  requiredIntegrations: ["HRIS", "Email/Slack"],
  dataRequired: ["Onboarding cases", "Tasks", "Owner assignments"],
  governanceControls: ["Critical review on readiness risk", "Audited escalations", "Eval gates"],
  successMetrics: ["Day-1 readiness", "Overdue owner tasks", "Missing docs", "Escalation rate"],
};

registerDomainPack(onboardingPack);
