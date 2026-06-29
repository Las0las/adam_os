/**
 * INTERNAL — kernel-private. Deterministic canonicalization, SHA-256 hashing, and
 * id minting. Centralised so the event hash chain, idempotency keys, and audit
 * records all derive from ONE canonical encoding. No package outside
 * @lawrence/kernel may import this module.
 */
import { createHash } from "node:crypto";

import type {
  ContentHash,
  DecisionId,
  EventId,
  MutationId,
} from "@lawrence/contracts";

/**
 * Stable JSON: object keys are emitted in sorted order at every depth so two
 * structurally-equal values always produce the same string (and thus the same
 * hash). Arrays preserve order; primitives encode as JSON.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = sortDeep(v);
  return out;
}

/** SHA-256 of a canonical string, hex-encoded. */
export function sha256(input: string): ContentHash {
  return createHash("sha256").update(input).digest("hex") as ContentHash;
}

/** Hash of any value via its canonical form. */
export function hashOf(value: unknown): ContentHash {
  return sha256(canonicalize(value));
}

export function mintDecisionId(mutationId: MutationId, decidedAt: string): DecisionId {
  return `dec_${sha256(`${mutationId}|${decidedAt}`).slice(0, 24)}` as DecisionId;
}

export function mintEventId(hash: ContentHash): EventId {
  return `evt_${hash.slice(0, 24)}` as EventId;
}
