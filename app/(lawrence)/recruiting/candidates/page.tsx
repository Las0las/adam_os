import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const ctx = await appContext();
  const candidates = listObjects(ctx, "Candidate");

  return (
    <>
      <PageHeader title="Candidates" sub="Candidate objects projected from ingested data." />
      <Metric label="Candidates" value={candidates.length} />
      <div className="card">
        <h3>Candidates</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Location</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/recruiting/candidates/${c.id}`}>{c.title ?? "—"}</Link>
                </td>
                <td className="muted">{String(c.properties.email ?? "—")}</td>
                <td className="muted">{String(c.properties.location ?? "—")}</td>
                <td>
                  <StatusBadge status={c.status ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
