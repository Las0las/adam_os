import { appContext } from "@/lib/app/demo-context";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function RuntimePage() {
  const ctx = await appContext();
  const health = runtimeHealth(ctx);

  const pct = (x: number) => (x * 100).toFixed(0) + "%";

  const rows: Array<{ label: string; value: string | number }> = [
    { label: "Pipeline failure rate", value: pct(health.pipelineFailureRate) },
    { label: "Function failure rate", value: pct(health.functionFailureRate) },
    { label: "Action failure rate", value: pct(health.actionFailureRate) },
    { label: "Notification failure rate", value: pct(health.notificationFailureRate) },
    { label: "Open incidents", value: health.openIncidents },
    { label: "Review backlog", value: health.reviewBacklog },
  ];

  return (
    <>
      <PageHeader title="Runtime" sub="Runtime health across the platform." />

      <div className="card" style={{ marginTop: 16 }}>
        {rows.map((row) => (
          <div className="row" key={row.label}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Runtime detail</h3>
        <p>
          <a href="./health">Runtime health</a>
        </p>
        <p>
          <a href="./audit">Runtime audit</a>
        </p>
      </div>
    </>
  );
}
