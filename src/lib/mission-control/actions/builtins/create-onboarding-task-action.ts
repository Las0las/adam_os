// Builtin action: create an onboarding task and (optionally) link it to a case.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";

registerAction({
  key: "create_onboarding_task",
  requiresApproval: false,
  precondition(_ctx, input) {
    return input.title != null ? null : "missing title";
  },
  async run(ctx, input) {
    const task = await upsertObject(ctx, {
      objectType: "OnboardingTask",
      externalKey: `task-${id("t")}`,
      title: String(input.title ?? "Task"),
      status: "open",
      properties: { caseId: input.caseId, ownerUserId: input.ownerUserId },
    });
    if (input.caseId) {
      await linkObjects(ctx, {
        linkType: "for",
        from: { objectType: "OnboardingTask", objectId: task.id },
        to: { objectType: "OnboardingCase", objectId: String(input.caseId) },
      });
    }
    return { taskId: task.id };
  },
});
