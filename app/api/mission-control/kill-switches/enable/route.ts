import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { enableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-service";
import type { RuntimeComponentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";

export const dynamic = "force-dynamic";

const EnableKillSwitchSchema = z.object({
  componentType: z.string().min(1),
  componentKey: z.string().min(1),
  environmentKey: z.string().optional(),
  reason: z.string().min(1),
});

// POST /api/mission-control/kill-switches/enable
// body: { componentType, componentKey, environmentKey?, reason }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, EnableKillSwitchSchema);
    return enableKillSwitch(ctx, {
      componentType: body.componentType as RuntimeComponentType,
      componentKey: body.componentKey,
      environmentKey: body.environmentKey,
      reason: body.reason,
      actorUserId: ctx.actorUserId,
    });
  });
}
