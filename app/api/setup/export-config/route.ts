import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { now } from "@/lib/lawrence-core/utils/ids";
import { exportConfig } from "@/lib/setup/export-service";

export const dynamic = "force-dynamic";

// POST /api/setup/export-config  → config without secrets
export async function POST() {
  const ctx = await appContext();
  return run(() => exportConfig(ctx, now()));
}
