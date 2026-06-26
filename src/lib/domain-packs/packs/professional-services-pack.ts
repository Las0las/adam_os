// Phase 8 — Professional Services domain pack (net-new; carries its own demo
// objects + evidence, reuses the platform's grounded answer function).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const professionalServicesPack: DomainPackManifest = {
  key: "professional_services",
  name: "Professional Services Pack",
  version: "1.0.0",
  category: "professional_services",
  description: "Engagement health, timesheet/invoice validation, margin leakage detection, delivery escalation.",
  objectTypes: ["Client", "Engagement", "Consultant", "Timesheet", "Invoice", "MarginSignal", "DeliveryIssue"],
  linkTypes: ["engagement_of_client", "timesheet_of_consultant"],
  functions: ["answer_with_citations", "recommend_next_action"],
  agents: [],
  actions: [],
  notificationRules: [
    { name: "Margin leakage detected", eventKey: "ps.margin_leakage", channel: "in_app", template: "Engagement {{subjectId}} shows margin leakage — review timesheet/invoice mismatch." },
  ],
  evalSuites: [
    { key: "ps_timesheet_validation_eval", name: "Timesheet validation retrieval", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "timesheet invoice mismatch margin", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "ps_margin_signal_eval", name: "Margin signal response", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "Is there a timesheet/invoice mismatch causing margin leakage?", objectTypes: ["Engagement"] }, expected: {} }] },
  ],
  demoScenarios: [
    {
      key: "margin-leakage-detection",
      packKey: "professional_services",
      name: "Margin Leakage Detection",
      description: "Detect a timesheet/invoice mismatch and escalate a margin signal.",
      persona: "executive",
      estimatedMinutes: 5,
      steps: [
        { key: "install", title: "Install Professional Services Pack", description: "Install runtime + engagement objects.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed; demo objects created." },
        { key: "objects", title: "Seed engagement", description: "Engagement with timesheet/invoice mismatch.", action: "create_demo_objects", payload: {}, expectedOutcome: "Engagement/consultant/timesheet/invoice exist." },
        { key: "validate", title: "Run margin check", description: "Grounded answer over engagement evidence.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "Is there a timesheet/invoice mismatch causing margin leakage?", objectTypes: ["Engagement"] } }, expectedOutcome: "Grounded margin-leakage answer + trace." },
        { key: "evals", title: "Run pack evals", description: "Timesheet + margin evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "Margin signal + executive action queue.", action: "open_command_center", payload: {}, expectedOutcome: "Demo professional-services work visible." },
      ],
    },
  ],
  sampleObjects: [
    { objectType: "Engagement", externalKey: "demo-engagement-1", title: "Engagement — Acme Data Platform", status: "active", properties: { marginRisk: true }, evidence: ["Engagement Acme Data Platform: billed 120 hours but timesheets show 168 logged hours. Invoice undercounts billable time — margin leakage."] },
    { objectType: "Consultant", externalKey: "demo-consultant-1", title: "Consultant — A. Okafor", properties: { utilization: 0.95 }, evidence: ["Consultant A. Okafor logged 168 hours this period across the Acme engagement; only 120 appear on the client invoice."] },
    { objectType: "Invoice", externalKey: "demo-invoice-1", title: "Invoice #4471", status: "draft", properties: { billedHours: 120 }, evidence: ["Invoice #4471 bills 120 hours. Timesheet evidence indicates 168 hours worked, a 48-hour margin leakage discrepancy."] },
  ],
  businessValue: "Recovers leaked margin by catching timesheet/invoice mismatches and delivery risks early.",
  implementationRoadmap: ["Connect PSA/finance", "Map engagement ontology", "Enable validation + margin signals", "Tune escalation"],
  requiredIntegrations: ["PSA tool", "Finance/ERP"],
  dataRequired: ["Engagements", "Timesheets", "Invoices"],
  governanceControls: ["Margin review", "Evidence-linked signals", "Audit"],
  successMetrics: ["Margin leakage prevented", "Validation cycle time", "Delivery issue escalation rate"],
};

registerDomainPack(professionalServicesPack);
