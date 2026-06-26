// Retrieval / context resolver (§22–§24). Tenant-scoped, permission-aware
// retrieval over evidence chunks. Every hit carries method + score + source +
// excerpt so answers are explainable (§56 hard rule #4). Supported methods:
// keyword, vector, augmented_keyword, hyde, rank_fusion.

import { db } from "@/lib/lawrence-core/db";
import { cosine, embed, tokenize } from "@/lib/dataops/evidence/chunking-service";
import { checkObjectAccessForActor } from "@/lib/security/access-guard";
import { redactForPrompt } from "@/lib/security/redaction-service";
import type { ActorContext } from "@/types/platform";
import type {
  EvidenceChunk,
  RetrievalHit,
  RetrievalMethod,
  RetrievalRequest,
  RetrievalResponse,
} from "@/types/dataops";

async function candidateChunks(req: RetrievalRequest): Promise<EvidenceChunk[]> {
  return await db.evidenceChunks.list(req.tenantId, (c) => {
    if (req.objectTypes?.length && !req.objectTypes.includes(c.sourceObjectType)) return false;
    if (req.subjectObjectId && c.sourceObjectId !== req.subjectObjectId) return false;
    return true;
  });
}

function toHit(chunk: EvidenceChunk, score: number, method: RetrievalMethod): RetrievalHit {
  return {
    objectType: chunk.sourceObjectType,
    objectId: chunk.sourceObjectId,
    chunkId: chunk.id,
    title: (chunk.metadata.documentTitle as string | undefined) ?? null,
    excerpt: chunk.text.slice(0, 280),
    score,
    method,
    metadata: { chunkIndex: chunk.chunkIndex },
  };
}

function keywordSearch(req: RetrievalRequest, chunks: EvidenceChunk[]): RetrievalHit[] {
  const terms = new Set(tokenize(req.query));
  if (terms.size === 0) return [];
  return chunks
    .map((c) => {
      const tokens = tokenize(c.text);
      let overlap = 0;
      for (const t of tokens) if (terms.has(t)) overlap += 1;
      const score = overlap / Math.sqrt(tokens.length || 1);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .map((x) => toHit(x.c, x.score, "keyword"));
}

function vectorSearch(
  req: RetrievalRequest,
  chunks: EvidenceChunk[],
  method: RetrievalMethod = "vector",
  queryText = req.query,
): RetrievalHit[] {
  const qVec = embed(queryText);
  return chunks
    .map((c) => {
      const emb = c.metadata.embedding as number[] | undefined;
      const score = emb ? cosine(qVec, emb) : 0;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .map((x) => toHit(x.c, x.score, method));
}

/** augmented_keyword: expand query with high-IDF-ish neighbouring tokens. */
function augmentedKeywordSearch(req: RetrievalRequest, chunks: EvidenceChunk[]): RetrievalHit[] {
  const seed = tokenize(req.query);
  const expansion = new Set(seed);
  for (const c of chunks) {
    const tokens = tokenize(c.text);
    if (tokens.some((t) => seed.includes(t))) {
      for (const t of tokens.slice(0, 12)) expansion.add(t);
    }
  }
  const expandedQuery = [...expansion].join(" ");
  return keywordSearch({ ...req, query: expandedQuery }, chunks).map((h) => ({
    ...h,
    method: "augmented_keyword" as const,
  }));
}

/** HyDE: synthesize a hypothetical answer doc, then vector-match against it. */
function hydeSearch(req: RetrievalRequest, chunks: EvidenceChunk[]): RetrievalHit[] {
  const hypothetical = `${req.query} ${req.query}`; // mock HyDE doc; real path calls the model
  return vectorSearch(req, chunks, "hyde", hypothetical);
}

/** Reciprocal-rank fusion across keyword + vector. */
function rankFusion(req: RetrievalRequest, chunks: EvidenceChunk[]): RetrievalHit[] {
  const k = 60;
  const lists = [keywordSearch(req, chunks), vectorSearch(req, chunks)];
  const fused = new Map<string, RetrievalHit & { rrf: number }>();
  for (const list of lists) {
    const ranked = [...list].sort((a, b) => b.score - a.score);
    ranked.forEach((hit, rank) => {
      const key = hit.chunkId ?? `${hit.objectId}:${hit.metadata?.chunkIndex}`;
      const prior = fused.get(key);
      const rrf = 1 / (k + rank + 1);
      if (prior) prior.rrf += rrf;
      else fused.set(key, { ...hit, method: "rank_fusion", rrf });
    });
  }
  return [...fused.values()].map(({ rrf, ...hit }) => ({ ...hit, score: rrf }));
}

const dispatch: Record<RetrievalMethod, (r: RetrievalRequest, c: EvidenceChunk[]) => RetrievalHit[]> = {
  keyword: keywordSearch,
  vector: vectorSearch,
  augmented_keyword: augmentedKeywordSearch,
  hyde: hydeSearch,
  rank_fusion: rankFusion,
};

export async function retrieve(ctx: ActorContext, req: RetrievalRequest): Promise<RetrievalResponse> {
  const chunks = await candidateChunks(req);
  const limit = req.limit ?? 10;
  const merged = new Map<string, RetrievalHit>();
  for (const method of req.methods) {
    for (const hit of dispatch[method](req, chunks)) {
      const key = `${hit.chunkId}:${hit.method}`;
      merged.set(key, hit);
    }
  }
  const ranked = [...merged.values()].sort((a, b) => b.score - a.score);

  // §D4 retrieval guard — enforce object read access per hit (no AI side door),
  // redact excerpts before they ever reach prompt/trace context, and record the
  // count of hits suppressed for lack of access. Fail closed: a denied or
  // errored access check drops the hit.
  const allowed: RetrievalHit[] = [];
  let deniedHitCount = 0;
  for (const hit of ranked) {
    if (allowed.length >= limit) break;
    let decision;
    try {
      decision = await checkObjectAccessForActor(ctx, {
        objectType: hit.objectType,
        objectId: hit.objectId,
        permission: "read",
        objectTenantId: req.tenantId,
      });
    } catch {
      deniedHitCount += 1;
      continue;
    }
    if (!decision.allowed) {
      deniedHitCount += 1;
      continue;
    }
    allowed.push({ ...hit, excerpt: redactForPrompt(hit.excerpt).text });
  }

  return {
    hits: allowed,
    trace: {
      methods: req.methods,
      candidateCount: chunks.length,
      returned: allowed.length,
      deniedHitCount,
    },
  };
}
