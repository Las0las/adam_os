// L0 — the Enterprise Constitution surface. The Constitution is itself an
// object; honoring the platform's own principle ("surfaces only project the
// truth, never own it") this page is a thin projection that delegates to the
// lens component. The root runtime supplies the document, headline counts, and
// a set of live, evidenced decisions for the audit lens.

import { getConstitution, projectHeadline, toConstitutionView } from "@/lib/constitution";
import { liveSampleDecisions } from "@/lib/constitution/sample-decisions";
import { ConstitutionLenses } from "@/components/lawrence/constitution/ConstitutionLenses";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const metadata = {
  title: "Constitution — LAWRENCE",
  description:
    "The root runtime: the constitution from which every layer derives its execution authority.",
};

export default function ConstitutionPage() {
  const view = toConstitutionView(getConstitution());
  const headline = projectHeadline(view);
  const decisions = liveSampleDecisions();

  return (
    <div className="page">
      <PageHeader
        title="Enterprise Constitution"
        sub={`The root runtime · v${view.version} · every layer derives its execution authority from an evidenced constitutional decision`}
      />
      <ConstitutionLenses constitution={view} headline={headline} decisions={decisions} />
    </div>
  );
}
