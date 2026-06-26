import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { disableKillSwitch } from "@/lib/mission-control/runtime/kill-switch-service";
import type { RuntimeComponentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";

export const dynamic = "force-dynamic";

// POST /api/mission-control/kill-switches/disable
// body: { componentType, componentKey, environmentKey?, reason? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{
    componentType: RuntimeComponentType;
    componentKey: string;
    environmentKey?: string;
    reason?: string;
  }>(request);
  return run(() =>
    disableKillSwitch(ctx, {
      componentType: body.componentType,
      componentKey: body.componentKey,
      environmentKey: body.environmentKey,
      reason: body.reason,
    }),
  );
}
