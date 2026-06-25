import { appContext } from "@/lib/app/demo-context";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ClaimCaseDetailPage({ params }: { params: { caseId: string } }) {
  const ctx = await appContext();
  const reviewCase = listReviewCases(ctx).find((c) => c.id === params.caseId);

  if (!reviewCase) {
    return (
      <Placeholder
        title="Claim case not found"
        note={`No review case with id ${params.caseId}.`}
      />
    );
  }

  return (
    <>
      <PageHeader title="Claim Case" sub="Claim validation review case detail." />
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td className="muted">Case Type</td>
              <td>{reviewCase.caseType}</td>
            </tr>
            <tr>
              <td className="muted">Severity</td>
              <td>{reviewCase.severity ?? "—"}</td>
            </tr>
            <tr>
              <td className="muted">Status</td>
              <td>
                <StatusBadge status={reviewCase.status ?? "neutral"} />
              </td>
            </tr>
            <tr>
              <td className="muted">Summary</td>
              <td>{reviewCase.summary ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
