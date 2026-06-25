import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function FunctionEvalsPage({
  params,
}: {
  params: { functionId: string };
}) {
  const ctx = await appContext();
  const runs = db.evalRuns.list(ctx.tenantId);

  if (runs.length === 0) {
    return (
      <>
        <PageHeader title={`Evals · ${params.functionId}`} />
        <Placeholder title="No eval runs" />
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Evals · ${params.functionId}`} />
      <div className="card">
        <h3>Eval runs</h3>
        <table>
          <thead>
            <tr>
              <th>Suite</th>
              <th>Score</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.suiteType}</td>
                <td>{r.score.toFixed(3)}</td>
                <td>{r.createdAt.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
