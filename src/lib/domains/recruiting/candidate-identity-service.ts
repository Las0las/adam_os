// Cross-source candidate identity resolution (§20 ontology, governance).
//
// The same person can arrive from LinkedIn, an ATS, and a pasted profile under
// different keys. upsertObject already dedupes an EXACT externalKey match; this
// resolves the harder case — the same human under different identifiers — by
// matching on identity signals (email / profile URL / name+phone).
//
// Detection is automated; the MERGE is not. Merging is destructive (it
// tombstones a record and re-points its graph edges), so it is a permissioned,
// audited, explicit action — never an automatic consequence of a fuzzy match.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";

export type MatchStrength = "strong" | "medium" | "weak";

export interface DuplicateMatch {
  candidate: OntologyObject;
  reason: string;
  strength: MatchStrength;
}

export interface CandidateIdentity {
  /** Exclude this object id from matches (the candidate being resolved). */
  id?: string;
  email?: string | null;
  profileUrl?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

function normEmail(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim().toLowerCase();
  return s || null;
}

function normName(v: unknown): string | null {
  const s = (v == null ? "" : String(v))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return s || null;
}

function normUrl(v: unknown): string | null {
  let s = v == null ? "" : String(v).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/[?#].*$/, "");
  return s || null;
}

function digits(v: unknown): string | null {
  const s = (v == null ? "" : String(v)).replace(/\D+/g, "");
  return s.length >= 7 ? s : null; // ignore too-short fragments
}

/** Phones match if one's digits are a suffix of the other's — tolerates a
 *  country-code prefix (e.g. "+1 415-555-0100" vs "415-555-0100"). */
function phoneMatch(a: unknown, b: unknown): boolean {
  const da = digits(a);
  const dbb = digits(b);
  if (!da || !dbb) return false;
  const [short, long] = da.length <= dbb.length ? [da, dbb] : [dbb, da];
  return long.endsWith(short);
}

function identityOf(c: OntologyObject): CandidateIdentity {
  const p = c.properties;
  return {
    id: c.id,
    email: (p.email as string) ?? null,
    profileUrl: (p.profileUrl as string) ?? null,
    fullName: (p.fullName as string) ?? c.title ?? null,
    phone: (p.phone as string) ?? null,
  };
}

/** Classify how strongly two identities refer to the same person (null = no match). */
function compare(a: CandidateIdentity, b: CandidateIdentity): { reason: string; strength: MatchStrength } | null {
  const ea = normEmail(a.email);
  if (ea && ea === normEmail(b.email)) return { reason: "same email", strength: "strong" };

  const ua = normUrl(a.profileUrl);
  if (ua && ua === normUrl(b.profileUrl)) return { reason: "same profile URL", strength: "strong" };

  const na = normName(a.fullName);
  if (na && na === normName(b.fullName)) {
    if (phoneMatch(a.phone, b.phone)) return { reason: "same name and phone", strength: "medium" };
    return { reason: "same name", strength: "weak" };
  }
  return null;
}

/**
 * Existing Candidate objects that may be the same person as `subject`. Excludes
 * the subject itself and already-merged tombstones. Sorted strongest first.
 */
export async function findDuplicateCandidates(
  ctx: ActorContext,
  subject: CandidateIdentity,
): Promise<DuplicateMatch[]> {
  const all = await listObjects(ctx, "Candidate");
  const matches: DuplicateMatch[] = [];
  for (const c of all) {
    if (c.id === subject.id) continue;
    if (c.status === "merged") continue;
    const verdict = compare(subject, identityOf(c));
    if (verdict) matches.push({ candidate: c, reason: verdict.reason, strength: verdict.strength });
  }
  const rank: Record<MatchStrength, number> = { strong: 0, medium: 1, weak: 2 };
  return matches.sort((x, y) => rank[x.strength] - rank[y.strength]);
}

export interface DuplicateCluster {
  survivor: OntologyObject;
  duplicate: OntologyObject;
  reason: string;
  strength: MatchStrength;
}

/**
 * Scan all candidates for likely-duplicate pairs. Returns only high-signal pairs
 * (strong / medium) to keep noise low — name-only ("weak") matches are excluded
 * because common names produce false positives. The older object is treated as
 * the survivor by default. Each unordered pair is reported once.
 */
export async function scanDuplicateClusters(ctx: ActorContext): Promise<DuplicateCluster[]> {
  const all = (await listObjects(ctx, "Candidate")).filter((c) => c.status !== "merged");
  const clusters: DuplicateCluster[] = [];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i]!;
      const b = all[j]!;
      const verdict = compare(identityOf(a), identityOf(b));
      if (!verdict || verdict.strength === "weak") continue;
      // Older record (earlier createdAt) survives.
      const [survivor, duplicate] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
      clusters.push({ survivor, duplicate, reason: verdict.reason, strength: verdict.strength });
    }
  }
  return clusters;
}

export interface MergeInput {
  survivorId: string;
  duplicateId: string;
  note?: string;
}

/**
 * Merge `duplicate` into `survivor`: re-point the duplicate's graph edges to the
 * survivor, backfill any properties the survivor is missing, record the
 * duplicate's key + provenance as aliases, and tombstone the duplicate
 * (status "merged", properties.mergedInto = survivor). Permissioned + audited;
 * idempotent (a re-merge of an already-merged duplicate is a no-op return).
 */
export async function mergeCandidates(ctx: ActorContext, input: MergeInput): Promise<OntologyObject> {
  requirePermission(ctx, "ontology.admin");
  if (input.survivorId === input.duplicateId) throw new Error("cannot merge a candidate into itself");

  const survivor = await db.ontologyObjects.get(ctx.tenantId, input.survivorId);
  const duplicate = await db.ontologyObjects.get(ctx.tenantId, input.duplicateId);
  if (!survivor || survivor.objectType !== "Candidate") throw new Error(`Survivor candidate not found: ${input.survivorId}`);
  if (!duplicate || duplicate.objectType !== "Candidate") throw new Error(`Duplicate candidate not found: ${input.duplicateId}`);
  if (duplicate.status === "merged") return survivor; // already merged — idempotent

  // 1. Re-point the duplicate's graph edges onto the survivor (skip self-loops).
  const links = await db.ontologyLinks.list(
    ctx.tenantId,
    (l) => l.fromObjectId === duplicate.id || l.toObjectId === duplicate.id,
  );
  for (const l of links) {
    const fromId = l.fromObjectId === duplicate.id ? survivor.id : l.fromObjectId;
    const toId = l.toObjectId === duplicate.id ? survivor.id : l.toObjectId;
    if (fromId === toId) {
      await db.ontologyLinks.delete(ctx.tenantId, l.id); // would become a self-loop
      continue;
    }
    await db.ontologyLinks.update(l.id, { fromObjectId: fromId, toObjectId: toId });
  }

  // 2. Backfill survivor properties from the duplicate (survivor wins on conflict),
  //    and record aliases + the duplicate's provenance/imports.
  const sp = survivor.properties;
  const dp = duplicate.properties;
  const filled: Record<string, unknown> = { ...sp };
  for (const [k, v] of Object.entries(dp)) {
    if (filled[k] == null && v != null && k !== "imports" && k !== "aliases") filled[k] = v;
  }
  const aliases = new Set<string>([
    ...((sp.aliases as string[] | undefined) ?? []),
    ...((dp.aliases as string[] | undefined) ?? []),
  ]);
  if (duplicate.externalKey) aliases.add(duplicate.externalKey);
  filled.aliases = [...aliases];
  const imports = [
    ...((sp.imports as unknown[] | undefined) ?? []),
    ...((dp.imports as unknown[] | undefined) ?? []),
  ];
  if (imports.length) filled.imports = imports;

  const merged = await db.ontologyObjects.update(survivor.id, { properties: filled, updatedAt: now() });

  // 3. Tombstone the duplicate with a pointer to the survivor.
  await db.ontologyObjects.update(duplicate.id, {
    status: "merged",
    properties: { ...dp, mergedInto: survivor.id },
    updatedAt: now(),
  });

  await emitAudit(ctx, "recruiting.candidate.merged", { type: "Candidate", id: survivor.id }, {
    duplicateId: duplicate.id,
    note: input.note ?? null,
  });
  return merged;
}
