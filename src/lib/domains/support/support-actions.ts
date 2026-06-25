// Phase 4 SUPPORT — draft-response action. Persists an AI support draft as a
// SupportDraftResponse ontology object (with citations + confidence), links it
// to its ticket, opens a review case for low-confidence drafts, and notifies the
// assignee. It never sends anything to the customer — a human releases the draft.
// Self-registers on import.

import { id } from "@/lib/lawrence-core/utils/ids";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";

registerAction({
  key: "support.create_draft_response",
  requiresApproval: false,
  precondition(_ctx: ActorContext, input) {
    return input.ticketId ? null : "missing ticketId";
  },
  async run(ctx: ActorContext, input) {
    const ticketId = String(input.ticketId);
    const draftResponse = String(input.draftResponse ?? "");
    const citations = Array.isArray(input.citations) ? input.citations : [];
    const confidence = Number(input.confidence ?? 0);
    const assigneeUserId = input.assigneeUserId ? String(input.assigneeUserId) : "system";

    const draft = await upsertObject(ctx, {
      objectType: "SupportDraftResponse",
      externalKey: `draft-${id("d")}`,
      title: "Draft response",
      properties: {
        ticketId,
        draftResponse,
        citations,
        confidence,
      },
    });

    await linkObjects(ctx, {
      linkType: "draft_for",
      from: { objectType: "SupportDraftResponse", objectId: draft.id },
      to: { objectType: "SupportTicket", objectId: ticketId },
    });

    let reviewCaseId: string | undefined;
    if (confidence < 0.5) {
      const rc = await openReviewCase(ctx, {
        caseType: "support.answer.needs_review",
        subject: { type: "SupportTicket", id: ticketId },
        severity: "medium",
        summary: "Low-confidence support draft",
      });
      reviewCaseId = rc.id;
    }

    await emitEvent(ctx, "support.draft.created", assigneeUserId, {
      subjectId: ticketId,
      draftId: draft.id,
      summary: "Draft response created",
    });

    return reviewCaseId ? { draftId: draft.id, reviewCaseId } : { draftId: draft.id };
  },
});
