import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { buildContexts } from "@/lib/projection-runtime/runtime/build-contexts";
import { resolveProjection } from "@/lib/projection-runtime/registry/projection-resolver";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { ProjectionSurface } from "@/components/lawrence/projection/ProjectionSurface";

export const dynamic = "force-dynamic";

// This page renders the Candidate create experience entirely from metadata. It
// resolves the "Candidate.Create.FullPage" projection server-side into a plain
// RenderPlan and hands it to the universal renderer. There is NO candidate-specific
// form code here — swap the projection id to "Candidate.Create.Modal" and the same
// definition renders as a modal instead.
export default async function NewCandidatePage() {
  const ctx = await appContext();
  const contexts = buildContexts(ctx);
  const { plan } = resolveProjection("Candidate.Create.FullPage", contexts);

  return (
    <>
      <PageHeader title="New candidate" sub="Rendered by the Universal Projection Runtime." />
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        <Link href="/recruiting/candidates">← Back to candidates</Link>
      </p>
      <ProjectionSurface plan={plan} />
    </>
  );
}
