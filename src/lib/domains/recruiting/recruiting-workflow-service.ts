// Phase 4 RECRUITING — candidate-fit workflow orchestrator. Runs the fit
// function, then routes deterministically: high-confidence shortlists go through
// the approval-gated action; everything else opens a review case. Always
// notifies the recipient. Does not rely on the generic agent condition evaluator.

import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import type { ActorContext } from "@/types/platform";
import type { DomainWorkflowResult } from "@/lib/domains/domain-workflow-types";
import type { CandidateFitOutput } from "./recruiting-functions";

interface RunCandidateFitInput {
  candidateId: string;
  jobId: string;
  recipientUserId?: string;
}

export async function runCandidateFitWorkflow(
  ctx: ActorContext,
  input: RunCandidateFitInput,
): Promise<DomainWorkflowResult> {
  const { candidateId, jobId } = input;
  const recipient = input.recipientUserId ?? "system";

  const fnRun = await runFunction(ctx, "recruiting.candidate_fit_summary", { candidateId, jobId });
  const out = (fnRun.output ?? {}) as CandidateFitOutput;

  const reviewCaseIds: string[] = [];
  const notificationIds: string[] = [];
  const actionExecutionIds: string[] = [];

  const shortlistable =
    ["shortlist", "submit_to_hiring_manager"].includes(out.recommendedNextAction) &&
    out.matchScore >= 0.75;

  if (shortlistable) {
    const exec = await executeAction(ctx, {
      actionKey: "recruiting.shortlist_candidate",
      input: { candidateId, jobId, rationale: out.summary, score: out.matchScore },
      object: { type: "Candidate", id: candidateId },
    });
    actionExecutionIds.push(exec.id);
    if (exec.reviewCaseId) reviewCaseIds.push(exec.reviewCaseId);

    const notes = await emitEvent(ctx, "recruiting.shortlist.created", recipient, {
      summary: `Candidate ${candidateId} shortlisted for ${jobId}`,
      subjectId: candidateId,
    });
    for (const n of notes) notificationIds.push(n.id);
  } else {
    const rc = await openReviewCase(ctx, {
      caseType: "recruiting.candidate_fit_review",
      subject: { type: "Candidate", id: candidateId },
      severity: "medium",
      summary: "Candidate fit needs review",
    });
    reviewCaseIds.push(rc.id);

    const notes = await emitEvent(ctx, "recruiting.fit.needs_review", recipient, {
      summary: `Candidate ${candidateId} fit needs review for ${jobId}`,
      subjectId: candidateId,
    });
    for (const n of notes) notificationIds.push(n.id);
  }

  return {
    domain: "recruiting",
    functionRunId: fnRun.id,
    output: out as unknown as Record<string, unknown>,
    reviewCaseIds,
    notificationIds,
    actionExecutionIds,
  };
}
