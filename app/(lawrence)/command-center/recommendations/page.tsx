import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const ctx = await appContext();
  const completedRuns = await db.functionRuns.list(ctx.tenantId, (r) => r.status === "completed");

  return (
    <>
      <PageHeader title="Recommendations" sub="Next-best-action suggestions from agent runs." />
      <div className="grid grid-4">
        <Metric label="Completed function runs" value={completedRuns.length} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Placeholder
          title="Recommendations"
          note="Surfaces recommend_next_action output once agents run on a schedule."
        />
      </div>
    </>
  );
}
