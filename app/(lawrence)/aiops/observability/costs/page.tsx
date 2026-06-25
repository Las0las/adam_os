import { appContext } from "@/lib/app/demo-context";
import { summarize } from "@/lib/aiops/observability/trace-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const ctx = await appContext();
  const obs = summarize(ctx);

  return (
    <>
      <PageHeader title="Costs" />
      <div className="grid grid-3">
        <Metric label="Total cost (USD)" value={obs.totalCostUsd.toFixed(2)} />
        <Metric label="Prompt tokens" value={obs.totalPromptTokens} />
        <Metric label="Completion tokens" value={obs.totalCompletionTokens} />
      </div>
    </>
  );
}
