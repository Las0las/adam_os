// Phase 8 — Support domain pack (productized over the Phase 4 support seed pack).
import { registerDomainPack } from "../domain-pack-registry";
import type { DomainPackManifest } from "../domain-pack-types";

export const supportPack: DomainPackManifest = {
  key: "support",
  name: "Support Pack",
  version: "1.0.0",
  category: "support",
  description: "Grounded ticket answers with citations, low-confidence review, and knowledge gap detection.",
  objectTypes: ["SupportTicket", "KnowledgeDocument", "SupportDraftResponse", "KnowledgeGap"],
  linkTypes: ["answer_of_ticket"],
  seedPackKey: "support",
  functions: ["support.answer_with_citations", "answer_with_citations"],
  agents: ["support.ticket_response"],
  actions: ["support.create_draft_response"],
  notificationRules: [],
  evalSuites: [
    { key: "support_ticket_retrieval_eval", name: "Ticket retrieval", suiteType: "retrieval", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { query: "VPN setup instructions", methods: ["rank_fusion"] }, expected: { expectedObjectRefs: [] } }] },
    { key: "support_grounded_answer_eval", name: "Grounded answer", suiteType: "response", targetComponentKey: "answer_with_citations", baselineScore: 0.1, cases: [{ input: { functionKey: "answer_with_citations", question: "How do I set up the VPN?", objectTypes: ["KnowledgeDocument"] }, expected: { forbiddenClaims: ["guaranteed"] } }] },
  ],
  demoScenarios: [
    {
      key: "grounded-ticket-response",
      packKey: "support",
      name: "Grounded Ticket Response with Citations",
      description: "Answer a VPN ticket from knowledge docs; route unsupported tickets to review + knowledge gap.",
      persona: "support_agent",
      estimatedMinutes: 5,
      steps: [
        { key: "install", title: "Install Support Pack", description: "Install runtime + knowledge docs.", action: "install_pack", payload: {}, expectedOutcome: "Pack installed." },
        { key: "objects", title: "Seed knowledge + ticket", description: "Knowledge docs + a VPN ticket.", action: "create_demo_objects", payload: {}, expectedOutcome: "Docs + ticket exist." },
        { key: "answer", title: "Answer with citations", description: "Grounded answer from the knowledge base.", action: "run_function", payload: { functionKey: "answer_with_citations", input: { question: "How do I set up the VPN?", objectTypes: ["KnowledgeDocument"] } }, expectedOutcome: "Draft answer with citations + trace." },
        { key: "evals", title: "Run pack evals", description: "Retrieval + grounded-answer evals.", action: "run_evals", payload: {}, expectedOutcome: "Eval scores recorded." },
        { key: "cc", title: "Open Command Center", description: "Low-confidence review + knowledge gap.", action: "open_command_center", payload: {}, expectedOutcome: "Demo support work visible." },
        { key: "audit", title: "Show audit trail", description: "Answer provenance is auditable.", action: "show_audit", payload: {}, expectedOutcome: "Audit shows citations + review routing." },
      ],
    },
  ],
  sampleObjects: [],
  businessValue: "Faster, citation-backed answers with automatic review of unsupported tickets.",
  implementationRoadmap: ["Connect ticketing + KB", "Index knowledge", "Enable answer + review", "Tune confidence thresholds"],
  requiredIntegrations: ["Ticketing system", "Knowledge base"],
  dataRequired: ["Tickets", "Knowledge documents"],
  governanceControls: ["Low-confidence review", "Citation enforcement", "Knowledge gap tracking", "Audit"],
  successMetrics: ["Answer confidence", "Citation coverage", "Time to draft", "Review rate", "Knowledge gaps"],
};

registerDomainPack(supportPack);
