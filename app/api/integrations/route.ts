import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import { listConnections, createConnection, type CreateConnectionInput } from "@/lib/integrations/integration-service";

export const dynamic = "force-dynamic";

const CreateConnectionSchema = z.object({}).passthrough();

// GET /api/integrations
export async function GET() {
  const ctx = await appContext();
  return ok(await listConnections(ctx));
}

// POST /api/integrations  body: CreateConnectionInput (credentialRef only, never a secret)
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = (await parseBody(request, CreateConnectionSchema)) as unknown as CreateConnectionInput;
    return createConnection(ctx, body);
  });
}
