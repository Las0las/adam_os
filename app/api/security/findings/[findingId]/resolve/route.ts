import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { resolveFinding } from "@/lib/security/security-finding-service";

export const dynamic = "force-dynamic";

// POST /api/security/findings/:findingId/resolve  body: { status? }
export async function POST(request: Request, { params }: { params: { findingId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ status?: "resolved" | "accepted_risk" | "in_review" }>(request);
  return run(() => resolveFinding(ctx, params.findingId, body.status ?? "resolved"));
}
