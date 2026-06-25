// Phase 4 — ONBOARDING live workflow pack: live workflow service.
// Runs the readiness function, and for each detected blocker fires the
// notify_owner action (approval-exempt). Collects action execution ids,
// notification ids, and any critical review-case ids, returning a typed
// DomainWorkflowResult.

import { db } from "@/lib/lawrence-core/db";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { listNotifications } from "@/lib/mission-control/notifications/notification-service";
import type { ActorContext } from "@/types/platform";
import type { DomainWorkflowResult } from "@/lib/domains/domain-workflow-types";
import type { ReadinessSummaryOutput, ReadinessBlocker } from "./onboarding-functions";

function asReadiness(output: unknown): ReadinessSummaryOutput | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (typeof o.ready !== "boolean" || !Array.isArray(o.blockers)) return null;
  return o as unknown as ReadinessSummaryOutput;
}

export async function runOnboardingReadinessWorkflow(
  ctx: ActorContext,
  input: { onboardingCaseId: string; recipientUserId?: string },
): Promise<DomainWorkflowResult> {
  const run = await runFunction(ctx, "onboarding.readiness_summary", {
    onboardingCaseId: input.onboardingCaseId,
  });

  const result: DomainWorkflowResult = {
    domain: "onboarding",
    functionRunId: run.id,
    output: (run.output as Record<string, unknown>) ?? undefined,
    reviewCaseIds: [],
    notificationIds: [],
    actionExecutionIds: [],
  };

  const readiness = asReadiness(run.output);

  // If the function failed or the case is ready, there is nothing to escalate.
  if (run.status !== "completed" || !readiness || readiness.ready) {
    return result;
  }

  // Snapshot notifications before escalation so we can collect newly created ids.
  const before = await listNotifications(ctx);
  const beforeIds = new Set(before.map((n) => n.id));

  let sawCritical = false;
  for (const blocker of readiness.blockers as ReadinessBlocker[]) {
    const ownerUserId =
      blocker.ownerUserId ?? input.recipientUserId ?? "system";
    if (blocker.severity === "critical") sawCritical = true;
    const exec = await executeAction(ctx, {
      actionKey: "onboarding.notify_owner",
      input: {
        onboardingCaseId: input.onboardingCaseId,
        ownerUserId,
        message: blocker.reason,
        severity: blocker.severity,
      },
      approvalExempt: true,
    });
    result.actionExecutionIds.push(exec.id);
  }

  // Collect newly created notification ids.
  const after = await listNotifications(ctx);
  for (const n of after) {
    if (!beforeIds.has(n.id)) result.notificationIds.push(n.id);
  }

  // Collect critical review cases (opened by the notify_owner action).
  if (sawCritical) {
    const reviewCases = await db.reviewCases.list(
      ctx.tenantId,
      (c) => c.caseType === "onboarding.case.critical",
    );
    for (const rc of reviewCases) result.reviewCaseIds.push(rc.id);
  }

  return result;
}
