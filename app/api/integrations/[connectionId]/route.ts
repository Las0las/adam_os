import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getConnection } from "@/lib/integrations/integration-service";

export const dynamic = "force-dynamic";

// GET /api/integrations/[connectionId]
export async function GET(_request: Request, { params }: { params: { connectionId: string } }) {
  const ctx = await appContext();
  const connection = await getConnection(ctx, params.connectionId);
  if (!connection) return fail("connection not found", 404);
  return ok(connection);
}
