import { NextResponse } from "next/server";
import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";

export const dynamic = "force-dynamic";

// GET /api/health — liveness/readiness probe for deployment.
export async function GET() {
  let database = false;
  try {
    await db.tenants.list("__healthcheck__");
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json({
    ok: database,
    database,
    migrations: "runtime-collections",
    runtime: "ok",
    timestamp: now(),
  });
}
