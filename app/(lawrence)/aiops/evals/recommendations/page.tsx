import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function RecommendationsEvalsPage() {
  const ctx = await appContext();
  const runs = await db.evalRuns.list(ctx.tenantId, (r) => r.suiteType === "recommendation");

  if (runs.length === 0) {
    return (
      <>
        <PageHeader title="Recommendation evals" />
        <Placeholder title="No recommendation eval runs" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Recommendation evals" />
      <div className="card">
        <h3>Recommendation eval runs</h3>
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
