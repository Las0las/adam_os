import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: { candidateId: string };
}) {
  const ctx = await appContext();
  const candidate = (await listObjects(ctx, "Candidate")).find((c) => c.id === params.candidateId);

  if (!candidate) {
    return (
      <Placeholder
        title="Candidate not found"
        note={`No Candidate object with id ${params.candidateId}.`}
      />
    );
  }

  return (
    <>
      <PageHeader title={candidate.title ?? "Candidate"} sub="Candidate detail" />
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td className="muted">Status</td>
              <td>
                <StatusBadge status={candidate.status ?? "neutral"} />
              </td>
            </tr>
            <tr>
              <td className="muted">Email</td>
              <td>{String(candidate.properties.email ?? "—")}</td>
            </tr>
            <tr>
              <td className="muted">Phone</td>
              <td>{String(candidate.properties.phone ?? "—")}</td>
            </tr>
            <tr>
              <td className="muted">Location</td>
              <td>{String(candidate.properties.location ?? "—")}</td>
            </tr>
            <tr>
              <td className="muted">Summary</td>
              <td>{String(candidate.properties.summary ?? "—")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
