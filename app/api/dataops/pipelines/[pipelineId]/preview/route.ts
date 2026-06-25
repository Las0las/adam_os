import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { previewAsset } from "@/lib/dataops/pipelines/pipeline-preview-service";

const TransformSchema = z.object({ key: z.string(), config: z.record(z.unknown()).default({}) });

const PreviewSchema = z.object({
  assetId: z.string().min(1),
  transforms: z.array(TransformSchema).optional(),
});

// POST /api/dataops/pipelines/:pipelineId/preview  body: { assetId, transforms? }
export async function POST(
  request: Request,
  _ctx: { params: { pipelineId: string } },
) {
  const ctx = await appContext();
  const body = PreviewSchema.parse(await request.json());
  const asset = await db.rawAssets.get(ctx.tenantId, body.assetId);
  if (!asset) return NextResponse.json({ error: `Unknown asset: ${body.assetId}` }, { status: 404 });

  const result = await previewAsset(ctx, asset, { transforms: body.transforms });
  return NextResponse.json(result);
}
