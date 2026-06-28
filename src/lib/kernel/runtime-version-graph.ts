// L0 kernel — the Runtime Version Graph.
//
// Review item #7: every RuntimeSnapshot must know EXACTLY which runtime graph
// produced it. The version graph is the immutable, acyclic record of the
// runtime nodes (Constitution, Kernel, Projection Composer, Workflow, …) and
// their pinned versions, plus a deterministic hash of the whole graph.
//
// A snapshot stamped with a runtimeGraphHash can be reproduced bit-for-bit:
// given the same graph + the same inputs, the runtime always produces the same
// output. When any node's version changes, the hash changes, so a replayed
// snapshot taken under an older graph is detectably different (not silently
// wrong).

import { getConstitution } from "@/lib/constitution";
import { stableHash } from "./stable-hash";

/** A single runtime node in the dependency graph. */
export interface RuntimeNode {
  /** Stable node id, e.g. "kernel". */
  id: string;
  /** Human label. */
  label: string;
  /** Pinned semantic version of this runtime. */
  version: string;
  /** Ids of the nodes this runtime depends on (must be lower in the hierarchy). */
  dependsOn: string[];
}

/** A resolved snapshot of every runtime node and its version. */
export interface RuntimeVersionGraph {
  nodes: RuntimeNode[];
  /** Deterministic hash over the (id, version, dependsOn) of every node. */
  graphHash: string;
}

// Pinned runtime versions. Bumping any of these changes the graph hash and is
// recorded on every snapshot taken thereafter. The constitution version is read
// live so the graph always reflects the ratified document.
const KERNEL_VERSION = "1.0.0";
const PROJECTION_COMPOSER_VERSION = "2.0.0"; // bumped: deterministic compose
const PROJECTION_RUNTIME_VERSION = "1.1.0";
const WORKFLOW_RUNTIME_VERSION = "0.1.0"; // declared, not yet built
const INTELLIGENCE_RUNTIME_VERSION = "0.1.0"; // declared, not yet built
const HOST_RUNTIME_VERSION = "0.1.0"; // declared, not yet built

/** Build the current runtime version graph. Pure given the constitution version. */
export function currentRuntimeGraph(): RuntimeVersionGraph {
  const constitutionVersion = getConstitution().version;
  const nodes: RuntimeNode[] = [
    { id: "constitution", label: "Constitution Runtime", version: constitutionVersion, dependsOn: [] },
    { id: "kernel", label: "Kernel Runtime", version: KERNEL_VERSION, dependsOn: ["constitution"] },
    { id: "projection-runtime", label: "Projection Runtime", version: PROJECTION_RUNTIME_VERSION, dependsOn: ["kernel"] },
    { id: "projection-composer", label: "Projection Composer", version: PROJECTION_COMPOSER_VERSION, dependsOn: ["projection-runtime", "kernel"] },
    { id: "workflow-runtime", label: "Workflow Runtime", version: WORKFLOW_RUNTIME_VERSION, dependsOn: ["kernel"] },
    { id: "intelligence-runtime", label: "Intelligence Runtime", version: INTELLIGENCE_RUNTIME_VERSION, dependsOn: ["kernel"] },
    { id: "host-runtime", label: "Host Runtime", version: HOST_RUNTIME_VERSION, dependsOn: ["projection-runtime"] },
  ];
  const graphHash = stableHash(
    nodes.map((n) => ({ id: n.id, v: n.version, d: [...n.dependsOn].sort() })),
  );
  return { nodes, graphHash };
}

/** Look up one node's pinned version in a graph. */
export function nodeVersion(graph: RuntimeVersionGraph, id: string): string | undefined {
  return graph.nodes.find((n) => n.id === id)?.version;
}
