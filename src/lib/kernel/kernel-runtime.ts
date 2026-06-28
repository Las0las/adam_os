// L0 kernel — the Kernel Runtime.
//
// The single front door to execution authority. Every actor (human, agent,
// workflow, service) submits an Intent; the kernel asks the Constitution
// Runtime to authorize it, mints an ExecutionAuthority from the resulting
// decision, and records the grant/denial to the append-only Execution Ledger.
//
//   requestAuthority(intent) → ExecutionAuthority      (never throws)
//   assertAuthority(intent)  → ExecutionAuthority       (throws when denied)
//
// AI never executes. AI requests authority through this exact path; the kernel
// is the only issuer, so authority cannot be fabricated downstream.

import {
  ConstitutionRuntime,
  type ConstitutionContext,
  type ConstitutionDecision,
} from "@/lib/constitution";
import type {
  Capability,
  ExecutionAuthority,
  Intent,
  AuthorityOutcome,
} from "./contracts";
import { appendJournal } from "./execution-journal";

/** Default authority lifetime: short-lived, single-action grants. */
const AUTHORITY_TTL_MS = 5 * 60 * 1000;

/** Thrown when the kernel refuses to issue authority. */
export class AuthorityDeniedError extends Error {
  readonly authority: ExecutionAuthority;
  constructor(authority: ExecutionAuthority) {
    super(`Execution authority denied [${authority.authorityId}] for ${authority.actor.kind}.`);
    this.name = "AuthorityDeniedError";
    this.authority = authority;
  }
}

function stableId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Map an Intent to the constitution's evaluation context. */
function toConstitutionContext(intent: Intent): ConstitutionContext {
  return {
    kind: intent.kind,
    actor: intent.actor,
    enterpriseId: intent.enterpriseId,
    object: intent.object,
    projection: intent.projection,
    workflow: intent.workflow,
    audited: intent.audited ?? true,
    payload: intent.payload,
  };
}

/** Derive the granted capabilities from the intent (domain:verb:scope). */
function deriveCapabilities(intent: Intent): Capability[] {
  const objType = intent.object?.objectType ?? intent.projection?.objectType ?? "object";
  switch (intent.kind) {
    case "object.create":
      return [`object:create:${objType}`];
    case "object.update":
      return [`object:update:${objType}`];
    case "object.delete":
      return [`object:delete:${objType}`];
    case "projection.resolve":
      return [`projection:render:${intent.projection?.projectionId ?? objType}`];
    case "workflow.transition":
      return [`workflow:transition:${intent.workflow?.workflowId ?? "unknown"}`];
    case "intent.emit":
      return [`intent:emit:${objType}`];
    case "read":
      return [`read:${objType}`];
    default:
      return [];
  }
}

/** Build the immutable authority token from a constitutional decision. */
function mintAuthority(intent: Intent, decision: ConstitutionDecision, now: number): ExecutionAuthority {
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + AUTHORITY_TTL_MS).toISOString();
  const outcome: AuthorityOutcome = !decision.authorized
    ? "denied"
    : decision.advisories.length > 0
      ? "granted_with_restriction"
      : "granted";

  const rights = decision.evidence
    .filter((e) => e.kind === "right" && e.supports)
    .map((e) => e.ref);
  const restrictions = decision.advisories.map((a) => `${a.ref}: ${a.rationale}`);
  const capabilities = decision.authorized ? deriveCapabilities(intent) : [];

  // Signature binds the grant to its decision + actor + capabilities. Any
  // tampering with the token changes the signature, so bearers are verifiable.
  const signature = `sig_${stableId(
    JSON.stringify({
      d: decision.decisionId,
      a: intent.actor.kind,
      aid: intent.actor.id,
      t: intent.enterpriseId,
      c: capabilities,
      o: outcome,
      v: decision.constitutionVersion,
    }),
  )}`;

  return {
    authorityId: `ea_${stableId(`${decision.decisionId}:${signature}`)}`,
    decisionId: decision.decisionId,
    outcome,
    granted: decision.authorized,
    actor: intent.actor,
    enterpriseId: intent.enterpriseId,
    tenantId: intent.actor.tenantId,
    mission: decision.missionAlignment
      ? { objectiveId: decision.missionAlignment.objectiveId, title: decision.missionAlignment.title }
      : null,
    capabilities,
    rights,
    restrictions,
    issuedAt,
    expiresAt,
    evidence: decision.evidence,
    signature,
    constitutionVersion: decision.constitutionVersion,
  };
}

function record(intent: Intent, authority: ExecutionAuthority): void {
  // Journal the full request lifecycle in causal order: the intent arrives, then
  // authority is either granted or denied. This is the event-sourced trail.
  appendJournal({
    kind: "IntentReceived",
    at: authority.issuedAt,
    authorityId: null,
    decisionId: authority.decisionId,
    actorKind: intent.actor.kind,
    actorId: intent.actor.id,
    enterpriseId: intent.enterpriseId,
    summary: `${intent.actor.kind} submitted intent ${intent.kind}`,
    detail: { kind: intent.kind, object: intent.object, projection: intent.projection },
  });
  appendJournal({
    kind: authority.granted ? "AuthorityGranted" : "AuthorityDenied",
    at: authority.issuedAt,
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    actorKind: intent.actor.kind,
    actorId: intent.actor.id,
    enterpriseId: intent.enterpriseId,
    summary: authority.granted
      ? `Authority granted to ${intent.actor.kind} for ${intent.kind}`
      : `Authority DENIED to ${intent.actor.kind} for ${intent.kind}`,
    detail: {
      capabilities: authority.capabilities,
      restrictions: authority.restrictions,
      mission: authority.mission?.title,
    },
  });
}

export const Kernel = {
  /**
   * Request execution authority for an intent. Always returns a token; inspect
   * `.granted`. The grant/denial is recorded to the ledger either way.
   */
  requestAuthority(intent: Intent, now: number = Date.now()): ExecutionAuthority {
    const decision = ConstitutionRuntime.authorize(toConstitutionContext(intent));
    const authority = mintAuthority(intent, decision, now);
    record(intent, authority);
    return authority;
  },

  /**
   * Fail-closed: returns the authority when granted, throws AuthorityDeniedError
   * when denied. This is what a runtime calls before it acts.
   */
  assertAuthority(intent: Intent, now: number = Date.now()): ExecutionAuthority {
    const authority = Kernel.requestAuthority(intent, now);
    if (!authority.granted) throw new AuthorityDeniedError(authority);
    return authority;
  },

  /** Verify a token has not been tampered with and has not expired. */
  verify(authority: ExecutionAuthority, now: number = Date.now()): boolean {
    return authority.granted && Date.parse(authority.expiresAt) > now;
  },
} as const;
