// Phase 7 — pure eval metric functions. Deterministic and dependency-free so
// they are trivially testable and reproducible.

export interface FieldAccuracy {
  exactMatchRate: number;
  missingFieldRate: number;
  hallucinatedFieldRate: number;
  typeAccuracy: number;
}

/** hit@k: 1 if any expected id appears within the top-k ranked ids. */
export function hitAtK(ranked: string[], expected: string[], k: number): number {
  const top = ranked.slice(0, k);
  return expected.some((e) => top.includes(e)) ? 1 : 0;
}

/** Mean reciprocal rank of the first expected id within the ranked list. */
export function reciprocalRank(ranked: string[], expected: string[]): number {
  for (let i = 0; i < ranked.length; i += 1) {
    if (expected.includes(ranked[i]!)) return 1 / (i + 1);
  }
  return 0;
}

/** Fraction of expected refs that appear among the citations. */
export function citationCoverage(
  citationIds: string[],
  expectedIds: string[],
): number {
  if (expectedIds.length === 0) return citationIds.length > 0 ? 1 : 0;
  const present = expectedIds.filter((e) => citationIds.includes(e)).length;
  return present / expectedIds.length;
}

/** Field-level extraction accuracy: exact / missing / hallucinated / type. */
export function fieldAccuracy(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): FieldAccuracy {
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  if (expectedKeys.length === 0) {
    return { exactMatchRate: 1, missingFieldRate: 0, hallucinatedFieldRate: 0, typeAccuracy: 1 };
  }
  let exact = 0;
  let missing = 0;
  let typeOk = 0;
  for (const k of expectedKeys) {
    const a = actual[k];
    const e = expected[k];
    if (a === undefined || a === null || a === "") missing += 1;
    if (String(a) === String(e)) exact += 1;
    if (typeof a === typeof e) typeOk += 1;
  }
  const hallucinated = actualKeys.filter((k) => !(k in expected)).length;
  return {
    exactMatchRate: exact / expectedKeys.length,
    missingFieldRate: missing / expectedKeys.length,
    hallucinatedFieldRate: actualKeys.length ? hallucinated / actualKeys.length : 0,
    typeAccuracy: typeOk / expectedKeys.length,
  };
}

export function containsAll(text: string, facts: string[]): { present: string[]; missing: string[] } {
  const lower = text.toLowerCase();
  const present: string[] = [];
  const missing: string[] = [];
  for (const f of facts) (lower.includes(f.toLowerCase()) ? present : missing).push(f);
  return { present, missing };
}

export function containsAny(text: string, claims: string[]): string[] {
  const lower = text.toLowerCase();
  return claims.filter((c) => lower.includes(c.toLowerCase()));
}

/** Average of a numeric list (0 for empty). */
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
