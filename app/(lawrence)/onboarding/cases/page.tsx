import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OnboardingCasesPage() {
  const ctx = await appContext();
  const cases = listObjects(ctx, "OnboardingCase");

  return (
    <>
      <PageHeader title="Onboarding Cases" sub="OnboardingCase objects projected from ingested data." />
      <Metric label="Cases" value={cases.length} />
      <div className="card">
        <h3>Cases</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/onboarding/cases/${c.id}`}>{c.title ?? "—"}</Link>
                </td>
                <td>
                  <StatusBadge status={c.status ?? "neutral"} />
                </td>
                <td className="muted">{String(c.properties.owner ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
