import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import { listReleaseBundles } from "@/lib/mission-control/runtime/release-repository";
import {
  createReleaseBundle,
  type CreateReleaseInput,
} from "@/lib/mission-control/deployments/release-bundle-service";

export const dynamic = "force-dynamic";

// GET /api/mission-control/releases
export async function GET() {
  const ctx = await appContext();
  return ok(await listReleaseBundles(ctx.tenantId));
}

// POST /api/mission-control/releases  body: CreateReleaseInput
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<CreateReleaseInput>(request);
  return run(() => createReleaseBundle(ctx, body));
}
