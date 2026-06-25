import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const ctx = await appContext();
  const jobs = listObjects(ctx, "Job");

  return (
    <>
      <PageHeader title="Jobs" sub="Seed domain pack — Job objects projected from ingested requisitions." />
      {jobs.length === 0 ? (
        <Placeholder title="Jobs" note="Jobs are projected from ingested requisitions." />
      ) : (
        <div className="card">
          <h3>Jobs</h3>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.title ?? "—"}</td>
                  <td>
                    <StatusBadge status={j.status ?? "neutral"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
