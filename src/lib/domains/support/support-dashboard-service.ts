// Phase 4 SUPPORT — dashboard service. Aggregates the support vertical's live
// state (open tickets, knowledge coverage, drafts, review backlog) into the
// generic DomainDashboard contract surfaced in the Command Center.

import { listObjects } from "@/lib/dataops/ontology/object-service";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import type { ActorContext } from "@/types/platform";
import type {
  DomainDashboard,
  DomainDashboardCard,
} from "@/lib/domains/domain-workflow-types";
import type { OntologyObject } from "@/types/dataops";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getSupportDashboard(ctx: ActorContext): Promise<DomainDashboard> {
  const tickets = await listObjects(ctx, "SupportTicket");
  const knowledgeDocs = await listObjects(ctx, "KnowledgeDocument");
  const drafts = await listObjects(ctx, "SupportDraftResponse");
  const reviewCases = await listReviewCases(ctx);

  const openTickets = tickets.filter((t) => (t.status ?? "open") === "open");
  const needsReview = reviewCases.filter(
    (c) => c.caseType === "support.answer.needs_review" && c.status === "open",
  );
  const lowConfidenceDrafts = drafts.filter((d) => num(d.properties.confidence) < 0.5);

  // Knowledge gaps: open tickets that have no draft yet (no grounded answer).
  const draftedTicketIds = new Set(
    drafts.map((d) => String(d.properties.ticketId ?? "")).filter(Boolean),
  );
  const knowledgeGaps = openTickets.filter((t) => !draftedTicketIds.has(t.id));

  // SLA risks: high/critical priority open tickets.
  const slaRisks = openTickets.filter((t) => {
    const priority = String(t.properties.priority ?? "").toLowerCase();
    return priority === "p1" || priority === "p2";
  });

  const ticketCard = (obj: OntologyObject): DomainDashboardCard["items"][number] => ({
    objectId: obj.id,
    title: obj.title ?? obj.externalKey ?? obj.id,
    status: obj.status ?? null,
  });

  const cards: DomainDashboardCard[] = [
    {
      key: "open_tickets",
      label: "Open Tickets",
      count: openTickets.length,
      items: openTickets.map(ticketCard),
    },
    {
      key: "tickets_needing_review",
      label: "Tickets Needing Review",
      count: needsReview.length,
      items: needsReview.map((c) => ({
        objectId: c.subjectObjectId ?? undefined,
        title: c.summary ?? "Support answer needs review",
        severity: c.severity ?? null,
        status: c.status,
      })),
    },
    {
      key: "low_confidence_drafts",
      label: "Low Confidence Drafts",
      count: lowConfidenceDrafts.length,
      items: lowConfidenceDrafts.map((d) => ({
        objectId: d.id,
        title: d.title ?? "Draft response",
        nextAction: "Review draft before sending",
      })),
    },
    {
      key: "knowledge_gaps",
      label: "Knowledge Gaps",
      count: knowledgeGaps.length,
      items: knowledgeGaps.map((t) => ({
        ...ticketCard(t),
        nextAction: "Add knowledge-base coverage",
      })),
    },
    {
      key: "sla_risks",
      label: "SLA Risks",
      count: slaRisks.length,
      items: slaRisks.map((t) => ({
        ...ticketCard(t),
        nextAction: "Prioritize response",
      })),
    },
  ];

  return {
    domain: "support",
    counts: {
      openTickets: openTickets.length,
      knowledgeDocs: knowledgeDocs.length,
      drafts: drafts.length,
      needsReview: needsReview.length,
    },
    cards,
  };
}
