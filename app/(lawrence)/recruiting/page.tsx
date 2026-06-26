import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function RecruitingPage() {
  const ctx = await appContext();
  const candidates = await listObjects(ctx, "Candidate");

  return (
    <>
      <PageHeader
        title="Recruiting"
        sub="Seed domain pack — Candidate objects projected from ingested data."
      />
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <Link className="btn" href="/recruiting/assistant">
          Open assistant — command or paste a profile
        </Link>
        <Link className="btn secondary" href="/recruiting/duplicates">
          Review duplicates
        </Link>
      </div>
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
                <td>{c.title}</td>
                <td className="muted">{String(c.properties.email ?? "—")}</td>
                <td className="muted">{String(c.properties.location ?? "—")}</td>
                <td>
                  <StatusBadge status={c.status ?? "new"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
