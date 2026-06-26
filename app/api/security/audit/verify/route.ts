import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { verifyAuditChain } from "@/lib/security/audit-integrity-service";

export const dynamic = "force-dynamic";

// POST /api/security/audit/verify  body: { from?, to? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ from?: string; to?: string }>(request);
  return run(() => verifyAuditChain(ctx, { from: body.from, to: body.to }));
}
