import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function RetrievalEvalsPage() {
  const ctx = await appContext();
  const runs = await db.evalRuns.list(ctx.tenantId, (r) => r.suiteType === "retrieval");

  if (runs.length === 0) {
    return (
      <>
        <PageHeader title="Retrieval evals" />
        <Placeholder title="No retrieval eval runs" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Retrieval evals" />
      <div className="card">
        <h3>Retrieval eval runs</h3>
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Cases</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.score.toFixed(3)}</td>
                <td>{r.results.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
