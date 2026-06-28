// L0 kernel — the RuntimeSnapshot.
//
// Review item #3: "the biggest missing architectural primitive." A snapshot is
// an immutable, fully-serializable capture of EVERYTHING needed to reproduce an
// execution exactly: the runtime version graph, the authority, the enterprise
// context, the captured runtime/host state, and the logical clock.
//
// Given a snapshot, any execution can be replayed bit-for-bit. The snapshotId is
// a content hash of the capture, so two executions with identical inputs produce
// the identical snapshotId — and any divergence (a version bump, a different
// instance value, a different actor) changes the id, making drift detectable
// rather than silent.

import type { ExecutionAuthority } from "./contracts";
import {
  currentRuntimeGraph,
  type RuntimeVersionGraph,
} from "./runtime-version-graph";
import { stableHash } from "./stable-hash";

/**
 * The runtime state captured into a snapshot. Everything here is plain,
 * serializable data (no functions) so the snapshot can cross any boundary and
 * be persisted, compared, or replayed. These are the inputs a deterministic
 * compose depends on beyond the projection/object definitions.
 */
export interface CapturedRuntimeState {
  /** The bound object instance (null for create). */
  instance: Record<string, unknown> | null;
  /** Effective surface (after any override). */
  surface: string;
  /** Effective mode. */
  mode: string;
  /** Locale, if any. */
  locale: string | null;
  /** Operator identity (no functions). */
  user: { tenantId: string; userId: string | null; displayName: string | null };
  /** Permission set in effect. */
  permissions: string[];
  /** Governance posture in effect. */
  policy: { requireApprovalFor: string[]; blockedIntents: string[] };
}

/** An immutable capture of one execution's full reproduction context. */
export interface RuntimeSnapshot {
  /** Content-derived id — identical inputs ⇒ identical id. */
  snapshotId: string;
  /** Logical capture time (ISO). */
  capturedAt: string;
  /** The runtime version graph that produced this execution. */
  versions: RuntimeVersionGraph;
  /** Convenience: the graph hash (also inside `versions`). */
  runtimeGraphHash: string;
  /** The authority under which the execution ran. */
  authorityId: string;
  authoritySignature: string;
  decisionId: string;
  /** Enterprise/tenant scope. */
  enterpriseId: string;
  /** Where/when it ran. */
  host: { surface: "server" | "client"; now: string };
  /** The captured, replayable runtime state. */
  runtimeState: CapturedRuntimeState;
}

export interface CreateSnapshotInput {
  authority: ExecutionAuthority;
  enterpriseId: string;
  host: { surface: "server" | "client"; now: string };
  runtimeState: CapturedRuntimeState;
  /** Optional explicit version graph (defaults to the current one). */
  versions?: RuntimeVersionGraph;
}

/**
 * Capture an immutable RuntimeSnapshot. Deterministic: the snapshotId is a hash
 * of every reproduction-relevant input, so calling this twice with equal inputs
 * yields the same id. `capturedAt` is taken from the injected host clock (never
 * Date.now()) so snapshots remain reproducible.
 */
export function createSnapshot(input: CreateSnapshotInput): RuntimeSnapshot {
  const versions = input.versions ?? currentRuntimeGraph();
  const snapshotId = `rs_${stableHash({
    g: versions.graphHash,
    a: input.authority.signature,
    d: input.authority.decisionId,
    e: input.enterpriseId,
    h: input.host,
    s: input.runtimeState,
  })}`;
  return Object.freeze({
    snapshotId,
    capturedAt: input.host.now,
    versions,
    runtimeGraphHash: versions.graphHash,
    authorityId: input.authority.authorityId,
    authoritySignature: input.authority.signature,
    decisionId: input.authority.decisionId,
    enterpriseId: input.enterpriseId,
    host: input.host,
    runtimeState: input.runtimeState,
  });
}
