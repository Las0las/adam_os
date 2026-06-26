// Execution Observability (Milestone 5.0) — content fingerprints.
//
// A fingerprint is a short, stable, NON-cryptographic digest of a value. The
// audit engine records the fingerprint of the request and the response so two
// executions can be compared for identity WITHOUT retaining or exposing the raw
// prompt/response text. This is a digest, never encryption: it is one-way and
// lossy, and it carries no secret. It must not be used as a security control.
//
// Determinism: object keys are serialized in sorted order so structurally equal
// values always fingerprint identically, regardless of property insertion order.

/** Canonical JSON: object keys emitted in sorted order, recursively. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/** FNV-1a 32-bit hash → 8-char lowercase hex. Fast, deterministic, no deps. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts (avoids BigInt / float precision loss).
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Stable fingerprint of any JSON-serializable value, prefixed with the content
 * length so trivially-distinct payloads of equal hash are still distinguishable.
 * Returns a fixed-shape token, e.g. "fp_1f3a2b4c_142".
 */
export function fingerprint(value: unknown): string {
  const text = canonical(value);
  return `fp_${fnv1a(text)}_${text.length}`;
}
