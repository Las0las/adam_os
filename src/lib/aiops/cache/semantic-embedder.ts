// IOS-009 — Semantic Cache — embedding similarity abstraction.
//
// A provider-independent embedding abstraction. The default implementation is a
// deterministic, local, hashing bag-of-words embedder — it uses NO external
// service and NO provider-specific embeddings (both out of scope for IOS-009).
// Determinism matters: identical text MUST embed identically, so semantic cache
// behavior is reproducible. A real/learned embedder can be injected later behind
// this same interface without changing the SemanticCacheStore.

/** Produces a fixed-dimension, L2-normalized vector for a piece of text. */
export interface Embedder {
  readonly name: string;
  readonly dimension: number;
  embed(text: string): number[];
}

function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** FNV-1a 32-bit hash of a token. */
function hash(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic local embedder: hashed bag-of-words with sign hashing, then
 *  L2-normalized so cosine similarity is a plain dot product. */
export class HashingEmbedder implements Embedder {
  readonly name = "hashing-bow";

  constructor(readonly dimension = 128) {}

  embed(text: string): number[] {
    const v = new Array<number>(this.dimension).fill(0);
    for (const token of tokenize(text)) {
      const h = hash(token);
      const idx = h % this.dimension;
      const sign = (h & 0x10000) === 0 ? 1 : -1; // sign hashing reduces collision bias
      v[idx] = (v[idx] ?? 0) + sign;
    }
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm);
    if (norm === 0) return v;
    for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / norm;
    return v;
  }
}

/** Cosine similarity of two equal-length vectors. For L2-normalized inputs this
 *  is their dot product; bounded to [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  if (dot > 1) return 1;
  if (dot < -1) return -1;
  return dot;
}
