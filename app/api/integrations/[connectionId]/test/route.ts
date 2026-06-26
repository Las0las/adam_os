import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { testConnectionHealth } from "@/lib/integrations/integration-health-service";

export const dynamic = "force-dynamic";

// POST /api/integrations/[connectionId]/test
export async function POST(_request: Request, { params }: { params: { connectionId: string } }) {
  const ctx = await appContext();
  return run(() => testConnectionHealth(ctx, params.connectionId));
}
