// L0 — the Enterprise Constitution surface. The Constitution is itself an
// object; honoring the platform's own principle ("surfaces only project the
// truth, never own it") this page is a thin projection that delegates to the
// lens component. The root runtime supplies the document, headline counts, and
// a set of live, evidenced decisions for the audit lens.

import { getConstitution, projectHeadline, toConstitutionView } from "@/lib/constitution";
import { liveSampleDecisions } from "@/lib/constitution/sample-decisions";
import { liveSampleAuthorities, getLedger } from "@/lib/kernel";
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
  // Run representative intents through the kernel — this ISSUES ExecutionAuthority
  // tokens and, as a side effect, appends grant/denial entries to the Execution
  // Ledger. Read the ledger AFTER so the surface reflects those writes.
  const authorities = liveSampleAuthorities();
  const ledger = getLedger(24);

  return (
    <div className="page">
      <PageHeader
        title="Enterprise Constitution"
        sub={`The root runtime · v${view.version} · every layer derives its execution authority from a signed, evidenced ExecutionAuthority issued by the kernel`}
      />
      <ConstitutionLenses
        constitution={view}
        headline={headline}
        decisions={decisions}
        authorities={authorities}
        ledger={ledger}
      />
    </div>
  );
}
