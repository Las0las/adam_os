import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ingestUpload } from "@/lib/dataops/ingestion/asset-ingest-service";

const UploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  contentBase64: z.string().optional(),
  content: z.string().optional(),
  sourceId: z.string().optional(),
  force: z.boolean().optional(),
});

// POST /api/dataops/assets/upload — ingest an uploaded blob into a raw asset.
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = UploadSchema.parse(await request.json());
  const bytes = body.contentBase64 != null ? Buffer.from(body.contentBase64, "base64") : undefined;
  const asset = await ingestUpload(ctx, {
    fileName: body.fileName,
    mimeType: body.mimeType,
    bytes,
    content: body.content,
    sourceId: body.sourceId,
    force: body.force,
  });
  return NextResponse.json({ asset });
}
