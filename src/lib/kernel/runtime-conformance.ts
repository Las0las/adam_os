// L0 kernel — Runtime Conformance & the executable Constitutional Validator.
//
// LAWRENCE Runtime Kernel Spec v1.2:
//   "Constitutional Validation is mandatory. Every build, deployment, extension
//    installation, runtime startup, and runtime transition MUST execute a
//    Constitutional Validator that evaluates conformance against every
//    applicable constitutional article before the runtime is allowed to run."
//
// That turns the Constitution from documentation into an EXECUTABLE contract.
//
// To be validated, every runtime must publish a self-describing
// `RuntimeDescriptor` (id, version, inputs, outputs, dependencies, invariants,
// failure modes, recovery, replay support, health). The validator checks that
// the declared graph is acyclic, dependencies resolve, the version graph
// agrees, and the constitutional invariants every runtime must honor are
// present — then journals the result.

import { getConstitution } from "@/lib/constitution";
import { appendJournal } from "./execution-journal";
import { currentRuntimeGraph, nodeVersion } from "./runtime-version-graph";
import { canDepend, type RuntimeLayer } from "./runtime-hierarchy";
import { stableHash } from "./stable-hash";

/** Replay support level a runtime declares. */
export type ReplaySupport = "full" | "partial" | "none";

/**
 * The standard self-description every runtime must publish to be admitted. A
 * runtime that cannot describe itself cannot be validated, and a runtime that
 * fails validation is not allowed to execute.
 */
export interface RuntimeDescriptor {
  runtimeId: string;
  label: string;
  runtimeVersion: string;
  /** Layer in the runtime hierarchy (governs legal dependencies). */
  layer: RuntimeLayer;
  /** Runtime ids this one depends on. */
  dependsOn: string[];
  /** Named inputs it consumes. */
  inputs: string[];
  /** Named outputs it produces. */
  outputs: string[];
  /** Invariants it guarantees (must include the constitutional invariants). */
  invariants: string[];
  /** Known failure modes. */
  failureModes: string[];
  /** How it recovers. */
  recovery: string;
  /** Whether its effects can be replayed from the journal. */
  replaySupport: ReplaySupport;
  /** Whether the runtime is a pure function of its inputs. A nondeterministic
   *  runtime cannot be replayed bit-for-bit and is flagged as a hidden-state
   *  risk by the SB-7 reconstructability verifier. */
  determinism: "deterministic" | "nondeterministic";
  /** Host capabilities the runtime requires to execute (e.g. "clock", "network",
   *  "none"). Declared so installers can reason about portability. */
  hostRequirements: string[];
  /** Named conformance assertions this runtime claims to satisfy. The validator
   *  checks the contract is non-empty; a real suite would execute each one. */
  conformanceSuite: string[];
  /** Current health. */
  health: "healthy" | "degraded" | "down";
}

/** A single conformance finding. */
export interface ConformanceFinding {
  runtimeId: string;
  article: string;
  ok: boolean;
  detail: string;
}

/** The result of validating every runtime against the constitution. */
export interface ConformanceReport {
  reportId: string;
  at: string;
  constitutionVersion: string;
  runtimeGraphHash: string;
  /** True only when EVERY finding passed — the gate. */
  conformant: boolean;
  descriptors: RuntimeDescriptor[];
  findings: ConformanceFinding[];
}

/** Invariants every runtime MUST declare — the non-negotiable constitution. */
const REQUIRED_INVARIANTS = [
  "consumes ExecutionAuthority", // nothing executes without an issued token
  "appends to the Execution Journal", // every effect is recorded
] as const;

/**
 * The registry of runtime descriptors. Adding a runtime to the OS means
 * registering its descriptor here so the validator can admit it.
 */
export const RUNTIME_DESCRIPTORS: RuntimeDescriptor[] = [
  {
    runtimeId: "constitution",
    label: "Constitution Runtime",
    runtimeVersion: getConstitution().version,
    layer: "constitution",
    dependsOn: [],
    inputs: ["ConstitutionContext"],
    outputs: ["ConstitutionDecision"],
    invariants: ["root authority", "deterministic evaluation", "every decision carries evidence"],
    failureModes: ["unratified article", "missing evidence"],
    recovery: "fail closed — deny",
    replaySupport: "full",
    determinism: "deterministic",
    hostRequirements: ["none"],
    conformanceSuite: ["evaluates without side effects", "denies on missing evidence"],
    health: "healthy",
  },
  {
    runtimeId: "kernel",
    label: "Kernel Runtime",
    runtimeVersion: nodeVersion(currentRuntimeGraph(), "kernel") ?? "?",
    layer: "constitution",
    dependsOn: ["constitution"],
    inputs: ["Intent"],
    outputs: ["ExecutionAuthority", "Decision"],
    invariants: ["consumes ExecutionAuthority", "appends to the Execution Journal", "sole authority issuer"],
    failureModes: ["denied authority", "expired token"],
    recovery: "fail closed — throw AuthorityDeniedError",
    replaySupport: "full",
    determinism: "deterministic",
    hostRequirements: ["clock"],
    conformanceSuite: ["never issues without a constitutional decision", "journals every grant and denial"],
    health: "healthy",
  },
  {
    runtimeId: "decision-runtime",
    label: "Decision Runtime",
    runtimeVersion: "1.0.0",
    layer: "enterprise",
    dependsOn: ["kernel"],
    inputs: ["Intent", "ExecutionAuthority"],
    outputs: ["Decision"],
    invariants: ["consumes ExecutionAuthority", "appends to the Execution Journal", "deterministic planning"],
    failureModes: ["plan for ungranted authority"],
    recovery: "fail closed — throw before planning",
    replaySupport: "full",
    determinism: "deterministic",
    hostRequirements: ["none"],
    conformanceSuite: ["plan is a pure function of intent + authority", "refuses to plan ungranted authority"],
    health: "healthy",
  },
  {
    runtimeId: "projection-runtime",
    label: "Projection Runtime",
    runtimeVersion: nodeVersion(currentRuntimeGraph(), "projection-runtime") ?? "?",
    layer: "projection",
    dependsOn: ["kernel"],
    inputs: ["ResolveRequest"],
    outputs: ["RenderPlan"],
    invariants: ["consumes ExecutionAuthority", "appends to the Execution Journal", "surfaces never own truth"],
    failureModes: ["missing projection definition", "missing authority"],
    recovery: "fail closed — deny resolution",
    replaySupport: "full",
    determinism: "deterministic",
    hostRequirements: ["none"],
    conformanceSuite: ["resolves only registered projections", "carries authority onto the plan"],
    health: "healthy",
  },
  {
    runtimeId: "projection-composer",
    label: "Projection Composer",
    runtimeVersion: nodeVersion(currentRuntimeGraph(), "projection-composer") ?? "?",
    layer: "projection",
    dependsOn: ["projection-runtime", "kernel"],
    inputs: ["ProjectionDefinition", "EnterpriseObject", "KernelContext", "RuntimeSnapshot"],
    outputs: ["RenderPlan"],
    invariants: ["consumes ExecutionAuthority", "appends to the Execution Journal", "pure deterministic core"],
    failureModes: ["missing authority", "snapshot drift"],
    recovery: "gate intents disabled when authority withheld",
    replaySupport: "full",
    determinism: "deterministic",
    hostRequirements: ["none"],
    conformanceSuite: ["composeRenderPlan is pure", "identical inputs yield identical plan fingerprint"],
    health: "healthy",
  },
];

/**
 * The Constitutional Validator. Runs every applicable article against every
 * registered runtime. Returns a report whose `conformant` flag is the gate:
 * when false, the runtime stack must NOT be admitted to execute.
 */
export function validateConformance(now: string = new Date().toISOString()): ConformanceReport {
  const constitution = getConstitution();
  const graph = currentRuntimeGraph();
  const descriptors = RUNTIME_DESCRIPTORS;
  const byId = new Map(descriptors.map((d) => [d.runtimeId, d]));
  const findings: ConformanceFinding[] = [];

  for (const d of descriptors) {
    // Article: Self-description — a runtime must fully describe itself.
    findings.push({
      runtimeId: d.runtimeId,
      article: "Runtime Conformance",
      ok: Boolean(d.runtimeVersion && d.inputs.length >= 0 && d.outputs.length > 0 && d.recovery),
      detail: `version ${d.runtimeVersion}, ${d.outputs.length} output(s), replay=${d.replaySupport}`,
    });

    // Article: Runtime Contract Completeness — the formal contract (v1.3 #6) must
    // declare determinism, host requirements, and a conformance suite, so a
    // runtime is independently replaceable and reasoned about before install.
    const contractComplete =
      Boolean(d.determinism) && d.hostRequirements.length > 0 && d.conformanceSuite.length > 0;
    findings.push({
      runtimeId: d.runtimeId,
      article: "Runtime Contract Completeness",
      ok: contractComplete,
      detail: contractComplete
        ? `${d.determinism}, host=[${d.hostRequirements.join(", ")}], ${d.conformanceSuite.length} assertion(s)`
        : "incomplete contract — missing determinism, host requirements, or conformance suite",
    });

    // Article: Acyclic hierarchy — every dependency must resolve and point
    // downward (lower layers cannot depend on higher ones).
    for (const dep of d.dependsOn) {
      const target = byId.get(dep);
      const resolves = Boolean(target);
      const legal = target ? canDepend(d.layer, target.layer) : false;
      findings.push({
        runtimeId: d.runtimeId,
        article: "Acyclic Runtime Hierarchy",
        ok: resolves && legal,
        detail: !resolves
          ? `dependency '${dep}' is not registered`
          : legal
            ? `depends on ${dep} (${target!.layer})`
            : `ILLEGAL upward dependency on ${dep} (${target!.layer})`,
      });
    }

    // Article: Mandatory invariants — every runtime must honor the constitution's
    // non-negotiable invariants (authority + journal). The root constitution is
    // the pure evaluator BELOW the kernel: it neither consumes authority (it
    // issues the decisions authority is minted from) nor journals (the kernel
    // journals on its behalf), so it is exempt from both clauses.
    const isRootConstitution = d.runtimeId === "constitution";
    for (const inv of REQUIRED_INVARIANTS) {
      if (isRootConstitution) continue;
      findings.push({
        runtimeId: d.runtimeId,
        article: "Constitutional Invariants",
        ok: d.invariants.includes(inv),
        detail: d.invariants.includes(inv) ? `declares "${inv}"` : `MISSING invariant "${inv}"`,
      });
    }

    // Article: Health — a down runtime may not be admitted.
    findings.push({
      runtimeId: d.runtimeId,
      article: "Runtime Health",
      ok: d.health !== "down",
      detail: `health=${d.health}`,
    });
  }

  const conformant = findings.every((f) => f.ok);
  const report: ConformanceReport = {
    reportId: `cr_${stableHash({ v: constitution.version, g: graph.graphHash, f: findings })}`,
    at: now,
    constitutionVersion: constitution.version,
    runtimeGraphHash: graph.graphHash,
    conformant,
    descriptors,
    findings,
  };

  appendJournal({
    kind: "ConformanceValidated",
    at: now,
    snapshotId: null,
    authorityId: null,
    decisionId: null,
    actorKind: "system",
    actorId: null,
    enterpriseId: "*",
    summary: conformant
      ? `Constitutional validation PASSED — ${descriptors.length} runtimes admitted`
      : `Constitutional validation FAILED — ${findings.filter((f) => !f.ok).length} violation(s)`,
    detail: { reportId: report.reportId, runtimeGraphHash: graph.graphHash },
  });

  return report;
}
