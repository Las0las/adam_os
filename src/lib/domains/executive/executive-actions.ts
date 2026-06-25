// Phase 4 EXECUTIVE / COMMERCIAL OPS — action handlers. The decision-memo
// writeback is approval-exempt; it links the memo to its account, opens a
// high-severity review case for high-risk accounts, and emits an event.
// Self-registers on import.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";

// executive.create_decision_memo — internal writeback, no approval gate.
registerAction({
  key: "executive.create_decision_memo",
  requiresApproval: false,
  precondition(_ctx: ActorContext, input: Record<string, unknown>): string | null {
    if (!input.accountId) return "missing accountId";
    if (!input.title) return "missing title";
    return null;
  },
  async run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const accountId = String(input.accountId);
    const title = String(input.title);
    const summary = input.summary == null ? null : String(input.summary);
    const recommendedActions = Array.isArray(input.recommendedActions) ? input.recommendedActions : [];
    const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [];
    const riskScore = Number(input.riskScore ?? 0);

    const memo = await upsertObject(ctx, {
      objectType: "DecisionMemo",
      externalKey: `memo-${id("m")}`,
      title,
      properties: {
        accountId,
        summary,
        recommendedActions,
        evidenceRefs,
      },
    });

    await linkObjects(ctx, {
      linkType: "about",
      from: { objectType: "DecisionMemo", objectId: memo.id },
      to: { objectType: "Account", objectId: accountId },
    });

    let reviewCaseId: string | undefined;
    if (riskScore >= 0.75) {
      const rc = await openReviewCase(ctx, {
        caseType: "executive.risk.high",
        subject: { type: "Account", id: accountId },
        severity: "high",
        summary: title,
      });
      reviewCaseId = rc.id;
    }

    await emitEvent(ctx, "executive.decision_memo.created", "system", {
      summary: `Decision memo created for account ${accountId}`,
      subjectId: accountId,
    });

    return reviewCaseId ? { memoId: memo.id, reviewCaseId } : { memoId: memo.id };
  },
});
