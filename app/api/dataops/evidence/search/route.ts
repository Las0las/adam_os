import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import type { RetrievalMethod } from "@/types/dataops";

export const dynamic = "force-dynamic";

// GET /api/dataops/evidence/search?q=...&methods=keyword,vector
export async function GET(request: Request) {
  const ctx = await appContext();
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const methods = (url.searchParams.get("methods")?.split(",").filter(Boolean) as
    | RetrievalMethod[]
    | undefined) ?? ["rank_fusion"];
  const response = await retrieve(ctx, { tenantId: ctx.tenantId, query, methods, limit: 10 });
  return NextResponse.json(response);
}
