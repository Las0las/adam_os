// RFC-C0-X — the Governed Execution Lifecycle surface. A live observability +
// reference surface over the gx runtime: it exercises the REAL runtime (which
// composes the kernel) and projects the 8-phase lifecycle, the 6 constitutional
// laws with their conformance proof, and the contrasting granted / denied /
// failed governed executions. Like Constitution and Kernel, it only PROJECTS
// truth — it owns no state.

import { liveGovernedExecutionModel } from "@/lib/gx";
import { GovernedExecutionView } from "@/components/lawrence/gx/GovernedExecutionView";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const metadata = {
  title: "Governed Execution — LAWRENCE",
  description:
    "RFC-C0-X: the governed execution lifecycle — Intent, Plan, Govern, Execute, Observe, Evaluate, Learn, Optimize — with constitutional law conformance.",
};

export default function GovernedExecutionPage() {
  // Exercise the real runtime; each governed execution appends an immutable
  // record as a side effect. The model bundles the conformance proof + records.
  const model = liveGovernedExecutionModel();

  return (
    <div className="page">
      <PageHeader
        title="Governed Execution"
        sub={`RFC-C0-X · the 8-phase lifecycle on a constitutional spine · ${model.conformant ? "all 6 laws hold" : "conformance breach"} · ${model.totalRecorded} immutable execution records`}
      />
      <GovernedExecutionView model={model} />
    </div>
  );
}
