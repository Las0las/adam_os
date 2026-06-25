import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ClaimCasesPage() {
  const ctx = await appContext();
  const cases = listReviewCases(ctx).filter((c) => c.caseType === "claim_validation");
  const docs = listObjects(ctx, "ClaimDocument");

  return (
    <>
      <PageHeader title="Claim Cases" sub="Claim validation review cases and ingested claim documents." />
      <div className="card">
        <h3>Validation Cases</h3>
        <table>
          <thead>
            <tr>
              <th>Summary</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/claims/cases/${c.id}`}>{c.summary ?? "—"}</Link>
                </td>
                <td className="muted">{c.severity ?? "—"}</td>
                <td>
                  <StatusBadge status={c.status ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Claim Documents</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Claimant</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.title ?? "—"}</td>
                <td className="muted">{String(d.properties.claimant ?? "—")}</td>
                <td className="muted">{String(d.properties.amount ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
