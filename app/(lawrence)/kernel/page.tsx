// L0 — the Kernel Explorer. A live observability surface over the kernel's own
// primitives: runtime topology (the version graph), issued execution authority,
// decision plans, runtime snapshots, replay determinism, SB-7 reconstructability,
// and the canonical execution journal. Like the Constitution surface, this page
// only PROJECTS the truth — it exercises the real runtime and renders what
// actually happened, owning no state of its own.

import {
  currentRuntimeGraph,
  liveSampleAuthorities,
  liveSampleDecision,
  liveSampleSnapshot,
  validateConformance,
  verifyReconstructability,
  getJournalDescending,
} from "@/lib/kernel";
import { proveReplayDeterminism, listEnterpriseObjects, listProjections } from "@/lib/projection-runtime";
import { KernelExplorer } from "@/components/lawrence/kernel/KernelExplorer";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const metadata = {
  title: "Kernel Explorer — LAWRENCE",
  description:
    "Observe the kernel: runtime topology, execution authority, decision plans, snapshots, replay determinism, and the execution journal.",
};

export default function KernelPage() {
  // Exercise the real runtime; each call issues authority and/or appends to the
  // canonical Execution Journal as a side effect. Read the journal AFTER.
  const graph = currentRuntimeGraph();
  const authorities = liveSampleAuthorities();
  const decision = liveSampleDecision();
  const snapshot = liveSampleSnapshot();
  const conformance = validateConformance();
  const replay = proveReplayDeterminism();
  // SB-7 runs last, after the exercises above have populated the journal. The
  // kernel can't read upward, so inject the canonical projection-layer sources.
  const reconstruction = verifyReconstructability({
    objectDefinitions: listEnterpriseObjects().map((o) => ({ objectType: o.objectType })),
    projectionDefinitions: listProjections().map((p) => ({ id: p.id })),
    journalDurable: false,
  });
  const journal = getJournalDescending(40);

  return (
    <div className="page">
      <PageHeader
        title="Kernel Explorer"
        sub={`The L0 substrate, observable · runtime graph ${graph.graphHash} · ${graph.nodes.length} runtimes · state derives from a signed ExecutionAuthority and the append-only journal`}
      />
      <KernelExplorer
        model={{ graph, conformance, reconstruction, authorities, decision, replay, snapshot, journal }}
      />
    </div>
  );
}
