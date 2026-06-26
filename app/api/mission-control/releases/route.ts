import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import { listReleaseBundles } from "@/lib/mission-control/runtime/release-repository";
import {
  createReleaseBundle,
  type CreateReleaseInput,
} from "@/lib/mission-control/deployments/release-bundle-service";

export const dynamic = "force-dynamic";

const CreateReleaseSchema = z.object({}).passthrough();

// GET /api/mission-control/releases
export async function GET() {
  const ctx = await appContext();
  return ok(await listReleaseBundles(ctx.tenantId));
}

// POST /api/mission-control/releases  body: CreateReleaseInput
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = (await parseBody(request, CreateReleaseSchema)) as unknown as CreateReleaseInput;
    return createReleaseBundle(ctx, body);
  });
}
