// Builtin action: emit a notification event; matching rules deliver.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";

registerAction({
  key: "create_notification",
  requiresApproval: false,
  async run(ctx, input) {
    const notes = await emitEvent(
      ctx,
      String(input.eventKey ?? "action.notify"),
      String(input.recipientUserId ?? ctx.actorUserId ?? "system"),
      (input.vars ?? {}) as Record<string, unknown>,
      input.deepLink as string | undefined,
    );
    return { count: notes.length };
  },
});
