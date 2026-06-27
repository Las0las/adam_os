import { appContext } from "@/lib/app/demo-context";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { GraphIntegrityView } from "@/components/lawrence/graph-integrity/GraphIntegrityView";

export const dynamic = "force-dynamic";

// VS-006 — Graph Integrity Review Surface. Read-only governance page: an operator
// explicitly runs the VS-005 graph integrity engine and reviews findings. It does
// not validate on load, never auto-fixes, and never changes write behavior.
export default async function GraphIntegrityPage() {
  await appContext();
  return (
    <>
      <PageHeader
        title="Graph Integrity"
        sub="Validate the enterprise ontology graph (ONT-001 objects · ONT-002 relationships · ADR-0009 graph)."
      />
      <GraphIntegrityView />
    </>
  );
}
