import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  const ctx = await appContext();
  const claims = listObjects(ctx, "ClaimDocument");
  const validations = listReviewCases(ctx).filter((c) => c.caseType === "claim_validation");
  return (
    <>
      <PageHeader title="Claims / Validation" sub="Seed domain pack — claim documents and validation cases." />
      <div className="grid grid-2">
        <div className="card">
          <h3>Claim documents</h3>
          {claims.map((c) => (
            <div className="row" key={c.id}>
              <span>
                {c.title} <span className="muted">· {String(c.properties.claimant ?? "")}</span>
              </span>
              <span className="muted">{String(c.properties.amount ?? "—")}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Validation review cases</h3>
          {validations.length === 0 ? (
            <p className="muted">No validation cases.</p>
          ) : (
            validations.map((v) => (
              <div className="row" key={v.id}>
                <span>{v.summary ?? v.caseType}</span>
                <StatusBadge status={v.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
