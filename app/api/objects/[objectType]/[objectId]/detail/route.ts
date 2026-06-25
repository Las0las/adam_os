import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { getObjectDetail, ObjectNotFoundError } from "@/lib/domains/object-detail/object-detail-service";

export const dynamic = "force-dynamic";

// GET /api/objects/:objectType/:objectId/detail
export async function GET(
  _request: Request,
  { params }: { params: { objectType: string; objectId: string } },
) {
  const ctx = await appContext();
  try {
    const data = await getObjectDetail(ctx, params.objectType, params.objectId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    throw err;
  }
}
