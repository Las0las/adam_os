// Phase 4 SUPPORT — ticket-response agent graph. Declares the live workflow as a
// governed node graph: input → retrieve KB + ticket context → answer-with-
// citations function → condition → review / create-draft action → notify → output.

import { now } from "@/lib/lawrence-core/utils/ids";
import type { AgentDefinition } from "@/types/aiops";

/** Ticket-response agent: RAG answer with citations, review gate, draft action. */
export function ticketResponseAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_support_ticket_response",
    tenantId,
    key: "support.ticket_response",
    name: "Support ticket response",
    description:
      "Retrieve knowledge, answer a ticket with citations, route low-confidence answers to review, and draft a response.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        {
          id: "retrieve",
          kind: "retrieve",
          config: { objectTypes: ["SupportTicket", "KnowledgeDocument"], methods: ["rank_fusion"] },
        },
        {
          id: "answer",
          kind: "function",
          config: { functionKey: "support.answer_with_citations", input: {} },
        },
        { id: "condition", kind: "condition", config: { field: "needsReview" } },
        {
          id: "review",
          kind: "review",
          config: {
            caseType: "support.answer.needs_review",
            severity: "medium",
            summary: "Support answer needs review",
          },
        },
        {
          id: "action",
          kind: "action",
          config: { actionKey: "support.create_draft_response", input: {} },
        },
        { id: "notify", kind: "notify", config: { eventKey: "support.draft.created" } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "answer" },
        { from: "answer", to: "condition" },
        { from: "condition", to: "review", condition: "needsReview" },
        { from: "condition", to: "action", condition: "!needsReview" },
        { from: "review", to: "notify" },
        { from: "action", to: "notify" },
        { from: "notify", to: "out" },
      ],
    },
  };
}
