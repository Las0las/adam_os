import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import {
  getEffectiveClassification,
  listClassificationsForObject,
} from "@/lib/security/data-classification-service";

export const dynamic = "force-dynamic";

// GET /api/security/classifications/:objectType/:objectId
export async function GET(
  _request: Request,
  { params }: { params: { objectType: string; objectId: string } },
) {
  const ctx = await appContext();
  const [records, effective] = await Promise.all([
    listClassificationsForObject(ctx.tenantId, params.objectType, params.objectId),
    getEffectiveClassification(ctx.tenantId, params.objectType, params.objectId),
  ]);
  return ok({ effective, records });
}
