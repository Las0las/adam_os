import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { runRetentionJob } from "@/lib/security/retention-service";

export const dynamic = "force-dynamic";

const RetentionRunSchema = z.object({
  policyId: z.string().min(1),
  asOf: z.string().optional(),
  dryRun: z.boolean().optional(),
});

// POST /api/security/retention/run  body: { policyId, asOf?, dryRun? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, RetentionRunSchema);
    return runRetentionJob(ctx, body.policyId, { asOf: body.asOf, dryRun: body.dryRun });
  });
}
