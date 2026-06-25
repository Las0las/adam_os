import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OnboardingCaseDetailPage({
  params,
}: {
  params: { caseId: string };
}) {
  const ctx = await appContext();
  const onboardingCase = listObjects(ctx, "OnboardingCase").find((c) => c.id === params.caseId);

  if (!onboardingCase) {
    return (
      <Placeholder
        title="Onboarding case not found"
        note={`No OnboardingCase object with id ${params.caseId}.`}
      />
    );
  }

  return (
    <>
      <PageHeader title={onboardingCase.title ?? "Onboarding Case"} sub="Onboarding case detail" />
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td className="muted">Title</td>
              <td>{onboardingCase.title ?? "—"}</td>
            </tr>
            <tr>
              <td className="muted">Status</td>
              <td>
                <StatusBadge status={onboardingCase.status ?? "neutral"} />
              </td>
            </tr>
            {Object.entries(onboardingCase.properties).map(([k, v]) => (
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
