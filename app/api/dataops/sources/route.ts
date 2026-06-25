import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { registerSource } from "@/lib/dataops/sources/source-service";

export const dynamic = "force-dynamic";

const SourceKind = z.enum([
  "upload",
  "dataset",
  "api",
  "gmail",
  "outlook",
  "sharepoint",
  "greenhouse",
  "lever",
  "gusto",
  "webhook",
]);

const RegisterSchema = z.object({
  name: z.string().min(1),
  kind: SourceKind,
  config: z.record(z.unknown()).optional(),
});

// GET /api/dataops/sources — list sources for the tenant.
export async function GET() {
  const ctx = await appContext();
  const sources = await db.sources.list(ctx.tenantId);
  return NextResponse.json({ sources });
}

// POST /api/dataops/sources — register a source.
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = RegisterSchema.parse(await request.json());
  const source = await registerSource(ctx, body);
  return NextResponse.json({ source });
}
