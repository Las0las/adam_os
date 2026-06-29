// Replay-determinism proof.
//
// Review items #2/#3: a RenderPlan must be a pure function of its inputs, and a
// RuntimeSnapshot must let any execution be reproduced exactly. This resolves the
// SAME projection twice with IDENTICAL inputs (same fixed clock, same instance,
// same contexts) and compares the resulting snapshotId + planFingerprint. If the
// runtime is deterministic the two are byte-identical; if anything leaked ambient
// state, they would differ. The audit lens renders this as a live gate.

import { compose } from "./projection-composer";
import { candidateObject } from "../definitions/candidate.object";
import { candidateCreatePage } from "../definitions/candidate.projections";
import type { ComposeInput } from "./projection-composer";
import type { Permission } from "@/types/platform";

export interface ReplayProof {
  projectionId: string;
  /** Fixed logical clock used for both resolves. */
  clock: string;
  /** Snapshot id from each resolve. */
  snapshotIdA: string;
  snapshotIdB: string;
  /** Plan fingerprint from each resolve. */
  fingerprintA: string;
  fingerprintB: string;
  /** The runtime version graph hash both ran under. */
  runtimeGraphHash: string;
  /** True iff both resolves produced an identical snapshot AND fingerprint. */
  deterministic: boolean;
}

function fixedInput(): ComposeInput {
  return {
    enterpriseObject: candidateObject,
    projectionDefinition: candidateCreatePage,
    userContext: { tenantId: "lawrence", userId: "user_recruiter_01", displayName: "Recruiter" },
    permissionContext: { permissions: ["ontology.admin"] as unknown as Permission[] },
    policyContext: { requireApprovalFor: [], blockedIntents: [] },
    runtimeContext: {
      now: "2026-01-01T00:00:00.000Z",
      instance: null,
      locale: "en-US",
    },
    principalKind: "human",
  };
}

/**
 * Resolve the same projection twice and compare. Pure determinism means the
 * snapshot id and plan fingerprint match exactly across runs.
 */
export function proveReplayDeterminism(): ReplayProof {
  const a = compose(fixedInput());
  const b = compose(fixedInput());
  return {
    projectionId: a.projectionId,
    clock: a.provenance.generatedAt,
    snapshotIdA: a.provenance.snapshotId,
    snapshotIdB: b.provenance.snapshotId,
    fingerprintA: a.provenance.planFingerprint,
    fingerprintB: b.provenance.planFingerprint,
    runtimeGraphHash: a.provenance.runtimeGraphHash,
    deterministic:
      a.provenance.snapshotId === b.provenance.snapshotId &&
      a.provenance.planFingerprint === b.provenance.planFingerprint,
  };
}
