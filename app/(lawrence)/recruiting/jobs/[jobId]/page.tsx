import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { jobId: string } }) {
  const ctx = await appContext();
  const job = (await listObjects(ctx, "Job")).find((j) => j.id === params.jobId);

  if (!job) {
    return <Placeholder title="Job not found" note={`No Job object with id ${params.jobId}.`} />;
  }

  return (
    <>
      <PageHeader title={job.title ?? "Job"} sub="Job detail" />
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td className="muted">Title</td>
              <td>{job.title ?? "—"}</td>
            </tr>
            <tr>
              <td className="muted">Status</td>
              <td>
                <StatusBadge status={job.status ?? "neutral"} />
              </td>
            </tr>
            {Object.entries(job.properties).map(([k, v]) => (
              <tr key={k}>
                <td className="muted">{k}</td>
                <td>{String(v ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
