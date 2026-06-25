import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";

export const dynamic = "force-dynamic";

const NodeSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "input",
    "parse",
    "transform",
    "join",
    "union",
    "chunk",
    "embed",
    "extract",
    "classify",
    "summarize",
    "output",
  ]),
  label: z.string(),
  config: z.record(z.unknown()).default({}),
});

const EdgeSchema = z.object({ from: z.string(), to: z.string() });

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(NodeSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

// GET /api/dataops/pipelines — list pipeline definitions.
export async function GET() {
  const ctx = await appContext();
  const pipelines = await db.pipelineDefinitions.list(ctx.tenantId);
  return NextResponse.json({ pipelines });
}

// POST /api/dataops/pipelines — create a pipeline definition.
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = CreateSchema.parse(await request.json());
  const ts = now();
  const pipeline = await db.pipelineDefinitions.insert({
    id: id("pipe"),
    tenantId: ctx.tenantId,
    name: body.name,
    description: body.description ?? null,
    nodes: body.nodes,
    edges: body.edges,
    version: 1,
    status: body.status ?? "draft",
    createdAt: ts,
    updatedAt: ts,
  });
  return NextResponse.json({ pipeline });
}
