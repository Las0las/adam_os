// L0 kernel — deterministic, dependency-free hashing.
//
// One shared hash for every kernel primitive (ledger ids, authority signatures,
// snapshot ids, render-plan fingerprints). Determinism is the whole point: the
// same input must always produce the same hash, on server or client, forever.

/** FNV-1a 32-bit over a string. Returns an 8-char lowercase hex string. */
export function stableStringHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Canonical JSON: object keys sorted recursively so structurally-equal values
 * always serialize identically (key order never affects the hash). Functions
 * and undefined are dropped.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (typeof v === "function" || v === undefined) continue;
    out[key] = sortValue(v);
  }
  return out;
}

/** Hash any serializable value deterministically (key order independent). */
export function stableHash(value: unknown): string {
  return stableStringHash(canonicalJson(value));
}
