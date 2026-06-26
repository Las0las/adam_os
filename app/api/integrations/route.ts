import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import { listConnections, createConnection, type CreateConnectionInput } from "@/lib/integrations/integration-service";

export const dynamic = "force-dynamic";

// GET /api/integrations
export async function GET() {
  const ctx = await appContext();
  return ok(await listConnections(ctx));
}

// POST /api/integrations  body: CreateConnectionInput (credentialRef only, never a secret)
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<CreateConnectionInput>(request);
  return run(() => createConnection(ctx, body));
}
