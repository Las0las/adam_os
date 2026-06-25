// Builtin action: open a review case from operational signals or AI output.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import type { ReviewCase } from "@/types/mission-control";

registerAction({
  key: "create_review_case",
  requiresApproval: false,
  precondition(_ctx, input) {
    return input.caseType != null ? null : "missing caseType";
  },
  async run(ctx, input) {
    const rc = await openReviewCase(ctx, {
      caseType: String(input.caseType ?? "manual"),
      subject: input.subject as { type: string; id: string } | undefined,
      severity: input.severity as ReviewCase["severity"],
      summary: String(input.summary ?? ""),
    });
    return { reviewCaseId: rc.id };
  },
});
