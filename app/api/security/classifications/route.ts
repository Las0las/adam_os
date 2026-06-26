import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { classifyObject } from "@/lib/security/data-classification-service";

export const dynamic = "force-dynamic";

const ClassificationSchema = z.object({
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  fieldPath: z.string().nullable().optional(),
  classification: z.string().min(1),
  source: z.string().optional(),
  confidence: z.number().nullable().optional(),
});

// POST /api/security/classifications
// body: { objectType, objectId, fieldPath?, classification, source?, confidence? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ClassificationSchema);
    return classifyObject(ctx, body as Parameters<typeof classifyObject>[1]);
  });
}
