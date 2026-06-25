import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { runAssetPipeline } from "@/lib/dataops/pipelines/pipeline-runner";

const TransformSchema = z.object({ key: z.string(), config: z.record(z.unknown()).default({}) });

const RunSchema = z.object({
  assetId: z.string().min(1),
  options: z
    .object({
      transforms: z.array(TransformSchema).optional(),
      buildEvidence: z.boolean().optional(),
      ontologyMapper: z.string().optional(),
    })
    .optional(),
});

// POST /api/dataops/pipelines/:pipelineId/run  body: { assetId, options? }
export async function POST(
  request: Request,
  { params }: { params: { pipelineId: string } },
) {
  const ctx = await appContext();
  const body = RunSchema.parse(await request.json());
  const asset = await db.rawAssets.get(ctx.tenantId, body.assetId);
  if (!asset) return NextResponse.json({ error: `Unknown asset: ${body.assetId}` }, { status: 404 });

  const result = await runAssetPipeline(ctx, asset, {
    ...(body.options ?? {}),
    pipelineId: params.pipelineId,
  });
  return NextResponse.json(result, { status: result.run.status === "failed" ? 422 : 200 });
}
