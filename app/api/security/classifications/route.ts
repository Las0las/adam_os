import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { classifyObject } from "@/lib/security/data-classification-service";
import type { ClassificationSource, DataClassification } from "@/lib/security/data-classification-types";

export const dynamic = "force-dynamic";

// POST /api/security/classifications
// body: { objectType, objectId, fieldPath?, classification, source?, confidence? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{
    objectType: string;
    objectId: string;
    fieldPath?: string | null;
    classification: DataClassification;
    source?: ClassificationSource;
    confidence?: number | null;
  }>(request);
  return run(() => classifyObject(ctx, body));
}
