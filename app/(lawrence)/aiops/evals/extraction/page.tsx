import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ExtractionEvalsPage() {
  const ctx = await appContext();
  const runs = await db.evalRuns.list(ctx.tenantId, (r) => r.suiteType === "extraction");

  if (runs.length === 0) {
    return (
      <>
        <PageHeader title="Extraction evals" />
        <Placeholder title="No extraction eval runs" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Extraction evals" />
      <div className="card">
        <h3>Extraction eval runs</h3>
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
