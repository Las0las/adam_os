import type { Metadata } from "next";
import {
  currentRuntimeGraph,
  validateConformance,
  verifyReconstructability,
} from "@/lib/kernel";
import { proveReplayDeterminism, listEnterpriseObjects, listProjections } from "@/lib/projection-runtime";
import { PrimerDeck, type PrimerMetrics } from "@/components/lawrence/primer/PrimerDeck";

export const metadata: Metadata = {
  title: "LAWRENCE — Architecture Primer",
  description:
    "Executive Architecture Primer for LAWRENCE, a Constitutional Enterprise Operating System. One governed runtime for the entire enterprise.",
};

export default function PrimerPage() {
  // Ground the primer in the REAL runtime — these figures are read live from the
  // kernel, not authored into slides. The primer is proven, not slideware.
  const graph = currentRuntimeGraph();
  const conformance = validateConformance();
  const replay = proveReplayDeterminism();
  const reconstruction = verifyReconstructability({
    objectDefinitions: listEnterpriseObjects().map((o) => ({ objectType: o.objectType })),
    projectionDefinitions: listProjections().map((p) => ({ id: p.id })),
    journalDurable: false,
  });

  const failing = conformance.findings.filter((f) => !f.ok).length;
  const metrics: PrimerMetrics = {
    runtimeCount: graph.nodes.length,
    runtimeGraphHash: graph.runtimeGraphHash,
    conformant: conformance.conformant,
    conformanceChecks: conformance.findings.length,
    conformanceFailing: failing,
    constitutionVersion: conformance.constitutionVersion,
    reconstructable: reconstruction.reconstructable,
    stateRootHash: reconstruction.stateRootHash,
    canonicalSources: reconstruction.sources.length,
    replayDeterministic: replay.deterministic,
    replayFingerprint: replay.fingerprintA,
    blockingRisks: reconstruction.hiddenStateRisks.filter((r) => r.severity === "blocker").length,
  };

  return <PrimerDeck metrics={metrics} />;
}
