// Evidence chunking + embedding (§22). Chunks are the citeable unit retrieval
// returns. Embeddings here are a deterministic bag-of-words hash vector so the
// vector path is exercisable without an external embedding provider.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { EvidenceChunk } from "@/types/dataops";

const DEFAULT_CHUNK_CHARS = 600;

/** Split text on paragraph boundaries, packing up to ~chunkChars per chunk. */
export function splitIntoChunks(text: string, chunkChars = DEFAULT_CHUNK_CHARS): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const para of paras) {
    if (buf.length + para.length > chunkChars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + para;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length ? chunks : text.trim() ? [text.trim()] : [];
}

const EMBEDDING_DIM = 64;

/** Deterministic hashed bag-of-words embedding (stand-in for a real model). */
export function embed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const token of tokenize(text)) {
    let h = 0;
    for (let i = 0; i < token.length; i += 1) h = (Math.imul(h, 31) + token.charCodeAt(i)) | 0;
    const slot = Math.abs(h) % EMBEDDING_DIM;
    vec[slot] = (vec[slot] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/** Chunk + embed a piece of text and persist evidence chunks for an object. */
export function indexEvidence(
  ctx: ActorContext,
  source: { objectType: string; objectId: string },
  text: string,
  metadata: Record<string, unknown> = {},
): EvidenceChunk[] {
  const chunks = splitIntoChunks(text);
  return chunks.map((chunkText, index) => {
    const vector = embed(chunkText);
    return db.evidenceChunks.insert({
      id: id("chunk"),
      tenantId: ctx.tenantId,
      sourceObjectType: source.objectType,
      sourceObjectId: source.objectId,
      chunkIndex: index,
      text: chunkText,
      metadata: { ...metadata, embedding: vector },
      embeddingId: `emb_${index}`,
      createdAt: now(),
    });
  });
}
