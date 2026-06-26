import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { runRetentionJob } from "@/lib/security/retention-service";

export const dynamic = "force-dynamic";

// POST /api/security/retention/run  body: { policyId, asOf?, dryRun? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ policyId: string; asOf?: string; dryRun?: boolean }>(request);
  return run(() => runRetentionJob(ctx, body.policyId, { asOf: body.asOf, dryRun: body.dryRun }));
}
