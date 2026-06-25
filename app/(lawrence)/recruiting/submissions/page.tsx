import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const ctx = await appContext();
  const submissions = listObjects(ctx, "Submission");

  return (
    <>
      <PageHeader title="Submissions" sub="Candidate submissions projected from ingested data." />
      {submissions.length === 0 ? (
        <Placeholder title="Submissions" note="No submissions projected yet." />
      ) : (
        <div className="card">
          <h3>Submissions</h3>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.title ?? "—"}</td>
                  <td>
                    <StatusBadge status={s.status ?? "neutral"} />
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
