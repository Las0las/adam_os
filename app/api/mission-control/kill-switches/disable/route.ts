import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { disableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-service";
import type { RuntimeComponentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";

export const dynamic = "force-dynamic";

const DisableKillSwitchSchema = z.object({
  componentType: z.string().min(1),
  componentKey: z.string().min(1),
  environmentKey: z.string().optional(),
  reason: z.string().optional(),
});

// POST /api/mission-control/kill-switches/disable
// body: { componentType, componentKey, environmentKey?, reason? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, DisableKillSwitchSchema);
    return disableKillSwitch(ctx, {
      componentType: body.componentType as RuntimeComponentType,
      componentKey: body.componentKey,
      environmentKey: body.environmentKey,
      reason: body.reason,
    });
  });
}
