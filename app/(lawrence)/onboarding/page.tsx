import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await appContext();
  const cases = listObjects(ctx, "OnboardingCase");
  return (
    <>
      <PageHeader title="Onboarding" sub="Seed domain pack — OnboardingCase objects and readiness." />
      <div className="card">
        <h3>Onboarding cases</h3>
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td className="muted">{String(c.properties.owner ?? "—")}</td>
                <td>
                  <StatusBadge status={c.status ?? "draft"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
