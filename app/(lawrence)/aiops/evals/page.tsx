import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  const ctx = await appContext();
  const runs = await db.evalRuns.list(ctx.tenantId);

  if (runs.length === 0) {
    return (
      <>
        <PageHeader title="Evals" />
        <Placeholder title="No eval runs" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Evals" />
      <div className="card">
        <div className="row">
          <Link href="/aiops/evals/retrieval">Retrieval</Link>
          <Link href="/aiops/evals/extraction">Extraction</Link>
          <Link href="/aiops/evals/responses">Responses</Link>
          <Link href="/aiops/evals/recommendations">Recommendations</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Eval runs</h3>
        <table>
          <thead>
            <tr>
              <th>Suite</th>
              <th>Score</th>
              <th>Cases</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.suiteType}</td>
                <td>{r.score.toFixed(3)}</td>
                <td>{r.results.length}</td>
                <td>{r.createdAt.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
