import { appContext } from "@/lib/app/demo-context";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  pipelineFailureRate: "Pipeline failure rate",
  functionFailureRate: "Function failure rate",
  actionFailureRate: "Action failure rate",
  notificationFailureRate: "Notification failure rate",
  openIncidents: "Open incidents",
  reviewBacklog: "Review backlog",
};

function formatValue(key: string, value: number): string {
  return key.endsWith("Rate") ? `${(value * 100).toFixed(1)}%` : String(value);
}

export default async function RuntimeHealthPage() {
  const ctx = await appContext();
  const health = await runtimeHealth(ctx);
  const entries = Object.entries(health) as Array<[string, number]>;

  return (
    <>
      <PageHeader
        title="Runtime Health"
        sub="Failure rates and backlog across the running platform."
      />
      <div className="grid grid-3">
        <Metric label="Open incidents" value={health.openIncidents} />
        <Metric label="Review backlog" value={health.reviewBacklog} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Health signals</h3>
        {entries.map(([key, value]) => (
          <div className="row" key={key}>
            <span>{LABELS[key] ?? key}</span>
            <span>{formatValue(key, value)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
