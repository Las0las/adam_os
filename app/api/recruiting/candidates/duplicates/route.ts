import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { scanDuplicateClusters } from "@/lib/domains/recruiting/candidate-identity-service";

export const dynamic = "force-dynamic";

// GET /api/recruiting/candidates/duplicates
// High-signal likely-duplicate candidate pairs (strong / medium matches only).
export async function GET() {
  const ctx = await appContext();
  return run(async () => {
    const clusters = await scanDuplicateClusters(ctx);
    return clusters.map((c) => ({
      survivorId: c.survivor.id,
      survivorTitle: c.survivor.title,
      duplicateId: c.duplicate.id,
      duplicateTitle: c.duplicate.title,
      reason: c.reason,
      strength: c.strength,
    }));
  });
}
