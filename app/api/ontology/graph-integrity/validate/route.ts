import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { getGraphIntegritySurface } from "@/lib/dataops/ontology/graph/graph-surface-service";

export const dynamic = "force-dynamic";

const ValidateGraphSchema = z.object({
  // Optional scope: validate only objects of these types (and edges between them).
  objectTypes: z.array(z.string()).optional(),
});

// POST /api/ontology/graph-integrity/validate
// body: { objectTypes?: string[] }
// Read-only, user-triggered graph integrity review (always warn-mode; never throws,
// never writes, never changes object/relationship write behavior).
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ValidateGraphSchema);
    return getGraphIntegritySurface(ctx, { objectTypes: body.objectTypes });
  });
}
