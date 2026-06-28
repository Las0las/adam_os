// L0 — the Enterprise Constitution surface. The Constitution is itself an
// object; honoring the platform's own principle ("surfaces only project the
// truth, never own it") this page is a thin projection that delegates to the
// lens component. The root runtime supplies the document, headline counts, and
// a set of live, evidenced decisions for the audit lens.

import { getConstitution, projectHeadline, toConstitutionView } from "@/lib/constitution";
import { liveSampleDecisions } from "@/lib/constitution/sample-decisions";
import { liveSampleAuthorities, liveSampleDecision, validateConformance, getJournalDescending } from "@/lib/kernel";
import { proveReplayDeterminism } from "@/lib/projection-runtime";
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
  // Exercise the runtime so the surface reflects real execution. Each of these
  // ISSUES authority and APPENDS to the canonical Execution Journal as a side
  // effect: representative intents through the kernel, plus a replay-determinism
  // proof that resolves the same projection twice. Read the journal AFTER.
  const authorities = liveSampleAuthorities();
  // The executable Constitutional Validator: admit the runtime stack only if it
  // conforms. And the Authority → Decision path: show what an authority plans.
  const conformance = validateConformance();
  const decisionPlan = liveSampleDecision();
  const replay = proveReplayDeterminism();
  const journal = getJournalDescending(36);

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
        decisionPlan={decisionPlan}
        conformance={conformance}
        journal={journal}
        replay={replay}
      />
    </div>
  );
}
