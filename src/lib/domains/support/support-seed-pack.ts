// Phase 4 SUPPORT — seed pack. Declares the support vertical's installable
// surface (sample tickets + knowledge docs with evidence, function/action/agent
// definition metadata, and notification rules) and self-registers it. Importing
// this module also pulls in the function + action handlers so they self-register.

import "./support-functions";
import "./support-actions";
import { registerDomainSeedPack } from "@/lib/domains/domain-seed-runner";
import { ticketResponseAgent } from "./support-agent-graphs";
import type { DomainSeedPack } from "@/lib/domains/domain-seed-types";

export const supportSeedPack: DomainSeedPack = {
  key: "support",
  name: "Support",
  description: "Ticket RAG with citations and human-in-the-loop review controls.",
  objectTypes: ["SupportTicket", "KnowledgeDocument", "SupportDraftResponse"],
  functions: [
    {
      key: "support.answer_with_citations",
      name: "Answer support ticket with citations",
      description:
        "Answer a support ticket grounded on knowledge-base evidence, returning citations and a review flag.",
      inputSchema: {
        type: "object",
        properties: { ticketId: { type: "string" }, query: { type: "string" } },
        required: ["ticketId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          draftResponse: { type: "string" },
          confidence: { type: "number" },
          citations: { type: "array" },
          missingEvidence: { type: "boolean" },
          needsReview: { type: "boolean" },
        },
        required: ["draftResponse", "confidence", "citations", "missingEvidence", "needsReview"],
      },
      handlerKey: "support.answer_with_citations",
    },
  ],
  agents: [
    {
      key: "support.ticket_response",
      name: "Support ticket response",
      description:
        "Retrieve knowledge, answer a ticket with citations, route low-confidence answers to review, and draft a response.",
      graph: ticketResponseAgent("__template__").graph as unknown as Record<string, unknown>,
    },
  ],
  actions: [
    {
      key: "support.create_draft_response",
      name: "Create support draft response",
      objectType: "SupportDraftResponse",
      handlerKey: "support.create_draft_response",
      inputSchema: {
        type: "object",
        properties: {
          ticketId: { type: "string" },
          draftResponse: { type: "string" },
          citations: { type: "array" },
          confidence: { type: "number" },
          assigneeUserId: { type: "string" },
        },
        required: ["ticketId"],
      },
    },
  ],
  notificationRules: [
    {
      key: "support.draft.created",
      name: "Support draft created",
      eventType: "support.draft.created",
      channel: "in_app",
      templateKey: "support.draft.created",
      template: "Support draft created: {{summary}}",
      config: {},
    },
    {
      key: "support.answer.needs_review",
      name: "Support answer needs review",
      eventType: "support.answer.needs_review",
      channel: "in_app",
      templateKey: "support.answer.needs_review",
      template: "Support answer needs review: {{summary}}",
      config: {},
    },
  ],
  sampleObjects: [
    {
      objectType: "SupportTicket",
      externalKey: "ticket-vpn",
      title: "VPN access issue",
      status: "open",
      properties: { priority: "p2" },
    },
    {
      objectType: "SupportTicket",
      externalKey: "ticket-billing",
      title: "Billing portal error",
      status: "open",
      properties: {},
    },
    {
      objectType: "KnowledgeDocument",
      externalKey: "kb-vpn",
      title: "VPN setup guide",
      properties: {},
      evidence: [
        "To connect to VPN, install the client and use SSO login",
        "Reset VPN MFA from the self-service portal",
      ],
    },
    {
      objectType: "KnowledgeDocument",
      externalKey: "kb-billing",
      title: "Billing portal troubleshooting",
      properties: {},
      evidence: [
        "If the billing portal shows an error, clear cache and re-authenticate",
        "Invoices update nightly",
      ],
    },
  ],
};

registerDomainSeedPack(supportSeedPack);

export { ticketResponseAgent };
