import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ExecutivePage() {
  const ctx = await appContext();
  const accounts = await listObjects(ctx, "Account");
  const opportunities = await listObjects(ctx, "Opportunity");

  return (
    <>
      <PageHeader title="Executive / Commercial Ops" sub="Account and opportunity rollups." />
      <Metric label="Accounts" value={accounts.length} />
      <Metric label="Opportunities" value={opportunities.length} />
      <div className="card">
        <h3>Accounts</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.title ?? "—"}</td>
                <td>
                  <StatusBadge status={a.status ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Opportunities</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id}>
                <td>{o.title ?? "—"}</td>
                <td>
                  <StatusBadge status={o.status ?? "neutral"} />
                </td>
                <td className="muted">{String(o.properties.value ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
