import type { Metadata } from "next";
import { PlatformProgramSurface } from "@/components/lawrence/program/PlatformProgram";
import { PLATFORM_PROGRAM, evaluateProgram, type LiveRuntimeFacts } from "@/lib/platform-program";
import { listEnterpriseObjects, listProjections, proveReplayDeterminism } from "@/lib/projection-runtime";
import { currentRuntimeGraph, validateConformance, verifyReconstructability } from "@/lib/kernel";

export const metadata: Metadata = {
  title: "LAWRENCE — Platform Engineering Program",
  description: "The executable backlog that builds LAWRENCE into a self-hosting Constitutional Enterprise Operating System.",
};

/**
 * Harvest ground-truth facts from the LIVE runtime, then let the pure engine
 * reconcile the declared program against them. The page asserts nothing it
 * cannot prove from the running system.
 */
export default function ProgramPage() {
  const graph = currentRuntimeGraph();
  const conformance = validateConformance();
  const replay = proveReplayDeterminism();
  const reconstruction = verifyReconstructability({
    objectDefinitions: listEnterpriseObjects().map((o) => ({ objectType: o.objectType })),
    projectionDefinitions: listProjections().map((p) => ({ id: p.id })),
    journalDurable: false,
  });

  const live: LiveRuntimeFacts = {
    registeredObjectTypes: listEnterpriseObjects().map((o) => o.objectType),
    registeredProjectionIds: listProjections().map((p) => p.id),
    runtimeIds: graph.nodes.map((n) => n.id),
    conformanceChecks: conformance.findings.length,
    conformanceFailures: conformance.findings.filter((f) => !f.ok).length,
    replayDeterministic: replay.deterministic,
    reconstructable: reconstruction.reconstructable,
    surfaces: ["/constitution", "/kernel", "/studio", "/primer", "/program"],
    // Grounded against the review: no vertical routes through the kernel yet.
    governedVerticals: [],
  };

  const report = evaluateProgram(PLATFORM_PROGRAM, live);

  return <PlatformProgramSurface program={PLATFORM_PROGRAM} report={report} live={live} />;
}
