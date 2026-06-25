// Phase 4 SUPPORT — live workflow orchestrator. Runs the ticket-RAG function,
// then either routes a needs-review answer to a review case OR executes the
// draft-response action (approval-exempt: nothing leaves the building), notifies
// the assignee, and returns a typed DomainWorkflowResult.

import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import type { ActorContext } from "@/types/platform";
import type { DomainWorkflowResult } from "@/lib/domains/domain-workflow-types";
import type { AnswerWithCitationsOutput } from "./support-functions";

export interface TicketResponseWorkflowInput {
  ticketId: string;
  query?: string;
  assigneeUserId?: string;
}

export async function runTicketResponseWorkflow(
  ctx: ActorContext,
  input: TicketResponseWorkflowInput,
): Promise<DomainWorkflowResult> {
  const { ticketId, query, assigneeUserId } = input;
  const assignee = assigneeUserId ?? "system";

  const reviewCaseIds: string[] = [];
  const notificationIds: string[] = [];
  const actionExecutionIds: string[] = [];

  const run = await runFunction(ctx, "support.answer_with_citations", { ticketId, query });
  const out = (run.output ?? {}) as Partial<AnswerWithCitationsOutput>;

  if (out.needsReview) {
    const rc = await openReviewCase(ctx, {
      caseType: "support.answer.needs_review",
      subject: { type: "SupportTicket", id: ticketId },
      severity: "medium",
      summary: "Support answer needs review",
    });
    reviewCaseIds.push(rc.id);
  } else {
    const exec = await executeAction(ctx, {
      actionKey: "support.create_draft_response",
      input: {
        ticketId,
        draftResponse: out.draftResponse ?? "",
        citations: out.citations ?? [],
        confidence: out.confidence ?? 0,
        assigneeUserId: assignee,
      },
      approvalExempt: true,
    });
    actionExecutionIds.push(exec.id);
    const execReviewCaseId = (exec.result?.reviewCaseId ?? exec.reviewCaseId) as
      | string
      | undefined;
    if (execReviewCaseId) reviewCaseIds.push(execReviewCaseId);
  }

  const notifications = await emitEvent(ctx, "support.draft.created", assignee, {
    subjectId: ticketId,
    summary: "Support draft workflow completed",
  });
  for (const n of notifications) notificationIds.push(n.id);

  return {
    domain: "support",
    functionRunId: run.id,
    output: (run.output ?? {}) as Record<string, unknown>,
    reviewCaseIds,
    notificationIds,
    actionExecutionIds,
  };
}
