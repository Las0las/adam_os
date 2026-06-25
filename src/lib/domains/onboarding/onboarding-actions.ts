// Phase 4 — ONBOARDING live workflow pack: actions.
// Two governed actions, both internal/non-customer-affecting (requiresApproval
// false): create an onboarding task (and assign+notify), and notify a task
// owner about a detected blocker (escalating to a critical review case when the
// severity warrants it).

import { id } from "@/lib/lawrence-core/utils/ids";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import {
  upsertObject,
  linkObjects,
  listObjects,
} from "@/lib/dataops/ontology/object-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import type { ActorContext } from "@/types/platform";

function str(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

// ── Action: onboarding.create_task ──────────────────────────────────────
// Creates an OnboardingTask, links it to its OnboardingCase, and (if assigned)
// notifies the owner. Internal-only side effect, no approval gate.
registerAction({
  key: "onboarding.create_task",
  requiredPermission: "ontology.admin",
  requiresApproval: false,
  precondition(_ctx, input) {
    return str(input.title) ? null : "missing title";
  },
  async run(ctx: ActorContext, input) {
    const onboardingCaseId = str(input.onboardingCaseId);
    const title = String(input.title);
    const ownerUserId = str(input.ownerUserId);
    const dueAt = str(input.dueAt);

    const task = await upsertObject(ctx, {
      objectType: "OnboardingTask",
      externalKey: `task-${id("t")}`,
      title,
      status: "open",
      properties: {
        caseId: onboardingCaseId ?? null,
        ownerUserId: ownerUserId ?? null,
        dueAt: dueAt ?? null,
      },
    });

    // Link the task to its case when we know the case.
    if (onboardingCaseId) {
      const cases = await listObjects(ctx, "OnboardingCase");
      const onboardingCase = cases.find((c) => c.id === onboardingCaseId);
      if (onboardingCase) {
        await linkObjects(ctx, {
          linkType: "onboarding.case_has_task",
          from: { objectType: "OnboardingCase", objectId: onboardingCase.id },
          to: { objectType: "OnboardingTask", objectId: task.id },
        });
      }
    }

    if (ownerUserId) {
      await emitEvent(ctx, "onboarding.task.assigned", ownerUserId, {
        title,
        taskId: task.id,
        subjectId: task.id,
      });
    }

    return { taskId: task.id };
  },
});

// ── Action: onboarding.notify_owner ─────────────────────────────────────
// Notifies a task owner about a detected blocker. Critical blockers also open
// a critical review case. Internal-only side effect, no approval gate.
registerAction({
  key: "onboarding.notify_owner",
  requiredPermission: "notifications.manage",
  requiresApproval: false,
  precondition(_ctx, input) {
    return str(input.ownerUserId) ? null : "missing ownerUserId";
  },
  async run(ctx: ActorContext, input) {
    const ownerUserId = String(input.ownerUserId);
    const message = str(input.message) ?? "Onboarding blocker detected";
    const severity = str(input.severity) ?? "medium";

    await emitEvent(ctx, "onboarding.blocker.detected", ownerUserId, {
      message,
      severity,
      subjectId: ownerUserId,
    });

    let reviewCaseId: string | undefined;
    if (severity === "critical") {
      const rc = await openReviewCase(ctx, {
        caseType: "onboarding.case.critical",
        severity: "critical",
        summary: message,
      });
      reviewCaseId = rc.id;
    }

    return reviewCaseId
      ? { notified: true, reviewCaseId }
      : { notified: true };
  },
});
