import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { listFunctions } from "@/lib/aiops/functions/function-registry";
import { summarize } from "@/lib/aiops/observability/trace-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AiOpsPage() {
  const ctx = await appContext();
  const fns = listFunctions();
  const runs = await db.functionRuns.list(ctx.tenantId);
  const obs = await summarize(ctx);

  return (
    <>
      <PageHeader
        title="AIOps"
        sub="Governed, typed AI functions and agents over the ontology and evidence."
      />
      <div className="grid grid-4">
        <Metric label="Functions" value={fns.length} />
        <Metric label="Function runs" value={runs.length} />
        <Metric label="Model traces" value={obs.traceCount} />
        <Metric label="Total cost (USD)" value={obs.totalCostUsd.toFixed(2)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Function registry</h3>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Class</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {fns.map((f) => (
              <tr key={f.key}>
                <td>
                  <code>{f.key}</code>
                </td>
                <td>
                  <span className="badge neutral">{f.klass}</span>
                </td>
                <td className="muted">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent function runs</h3>
        {runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          runs
            .slice(-8)
            .reverse()
            .map((r) => (
              <div className="row" key={r.id}>
                <span>
                  <code>{r.functionId}</code> · {r.citations?.length ?? 0} citations
                </span>
                <StatusBadge status={r.status} />
              </div>
            ))
        )}
      </div>
    </>
  );
}
