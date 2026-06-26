import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { verifyAuditChain } from "@/lib/security/audit-integrity-service";

export const dynamic = "force-dynamic";

const AuditVerifySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// POST /api/security/audit/verify  body: { from?, to? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, AuditVerifySchema);
    return verifyAuditChain(ctx, { from: body.from, to: body.to });
  });
}
