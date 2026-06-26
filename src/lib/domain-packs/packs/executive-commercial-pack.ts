// Phase 8 — Executive Commercial domain pack (productized over the Phase 4 executive seed pack).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const executiveCommercialPack: DomainPackManifest = {
  key: "executive",
  name: "Executive Commercial Pack",
  version: "1.0.0",
  category: "executive",
  description: "Account risk briefs, margin/delivery risk monitoring, and governed decision memos.",
  objectTypes: ["Account", "Opportunity", "Contract", "RiskSignal", "DecisionMemo", "RecommendedAction"],
  linkTypes: ["opportunity_of_account", "risk_of_account"],
  seedPackKey: "executive",
  functions: ["executive.account_risk_brief", "answer_with_citations"],
  agents: ["executive.commercial_risk_monitor"],
  actions: ["executive.create_decision_memo"],
  notificationRules: [],
  evalSuites: [
    { key: "executive_account_risk_retrieval_eval", name: "Account risk retrieval", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "margin compression delivery risk", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "executive_decision_memo_response_eval", name: "Decision memo response", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "What are the account risks and recommended escalation?", objectTypes: ["Account"] }, expected: { requiredFacts: ["risk"] } }] },
  ],
  demoScenarios: [
    {
      key: "account-risk-to-decision-memo",
      packKey: "executive",
      name: "Account Risk to Decision Memo",
      description: "Brief an at-risk account and produce a governed decision memo in the executive queue.",
      persona: "executive",
      estimatedMinutes: 6,
      steps: [
        { key: "install", title: "Install Executive Commercial Pack", description: "Install runtime + account risk evidence.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed." },
        { key: "objects", title: "Seed account + risk", description: "Account with margin + delivery risk evidence.", action: "create_demo_objects", payload: {}, expectedOutcome: "Account + risk signals exist." },
        { key: "brief", title: "Run account risk brief", description: "Grounded executive risk brief.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "What are the account risks and recommended escalation?", objectTypes: ["Account"] } }, expectedOutcome: "Grounded risk brief + trace." },
        { key: "evals", title: "Run pack evals", description: "Risk retrieval + decision memo evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "High-severity risk queue + decision memo.", action: "open_command_center", payload: {}, expectedOutcome: "Demo executive work visible." },
        { key: "audit", title: "Show audit trail", description: "Recommended actions + evidence auditable.", action: "show_audit", payload: {}, expectedOutcome: "Audit shows decision provenance." },
      ],
    },
  ],
  sampleObjects: [],
  businessValue: "Surfaces commercial risk early and produces auditable, evidence-backed decision memos.",
  implementationRoadmap: ["Connect CRM/finance", "Map account ontology", "Enable risk + decision memos", "Tune approval policies"],
  requiredIntegrations: ["CRM", "Finance/ERP"],
  dataRequired: ["Accounts", "Opportunities", "Contracts/invoices"],
  governanceControls: ["High-severity review", "Approval-gated decision memos", "Audit", "Eval gates"],
  successMetrics: ["Risk resolution time", "Approval cycle time", "Margin leakage prevented", "Decision memo throughput"],
};

registerDomainPack(executiveCommercialPack);
