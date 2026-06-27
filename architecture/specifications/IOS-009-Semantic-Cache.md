# IOS-009 — Semantic Cache

| Field | Value |
|-------|-------|
| Identifier | IOS-009 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004, IOS-005, IOS-006, IOS-007, IOS-008, DD-001 |

## Purpose

The Semantic Cache SHALL serve a cached response when a new request is
*semantically* similar (above a confidence threshold) to a previously stored one,
reducing provider calls for near-duplicate prompts. It is realized as an
additional `CacheStore` (IOS-007) — demonstrating the Cache Platform's extension
contract: a new strategy requires only implement → register → configure, with NO
execution-pipeline or CacheManager change.

## Scope

Governs the `SemanticCacheStore`, an embedding-similarity abstraction, a
similarity policy with a confidence threshold, and semantic events/metrics. Out
of scope (future specifications): distributed vector stores, provider-specific
embeddings, adaptive thresholds, learned similarity, cross-provider cache reuse.

## Responsibilities

- Embed the request prompt with a provider-independent embedder (default: a
  deterministic local hashing bag-of-words embedder).
- Within a compatibility group (provider + model + workload + response format),
  return the most similar stored response whose cosine similarity ≥ threshold.
- On a miss, return no hit so the CacheManager continues to the ExactMatch store
  and then the provider.
- Honor TTL and capacity (from the CachePolicy) and publish semantic events +
  collect semantic metrics.

## Public Interfaces

- `SemanticCacheStore` (implements the IOS-007 `CacheStore` contract).
- `Embedder` abstraction + `HashingEmbedder` + `cosineSimilarity`.
- `SimilarityPolicy`, `SimilarityPolicyStore` (immutable): enabled, threshold.
- Semantic events (`semantic.hit`, `semantic.miss`, `semantic.stored`);
  `isSemanticEvent`.
- `SemanticCacheMetricsCollector`.

## Integration

The store is registered on the existing `cachePlatform().registry` **after** the
ExactMatchCacheStore (so exact matches are tried first, the semantic store catches
near-matches). The CacheResolver consults it because it is registered; the
CacheManager, Execution Pipeline, and PromptCache middleware are unchanged. The
canonical `cache.*` events for the "semantic" store are still published by the
CacheManager (preserving IOS-007's invariant that the manager owns canonical cache
events and per-store cache metrics); the store additionally publishes `semantic.*`
events carrying similarity detail.

## Invariants

- A response SHALL be reused only within the SAME compatibility group (no
  cross-provider reuse).
- A hit SHALL require cosine similarity ≥ the confidence threshold.
- Cached responses SHALL be immutable; failures SHALL NOT be cached (the
  CacheManager only records validated successes).
- The SimilarityPolicy SHALL be immutable during execution.
- A cache hit (semantic included) SHALL NOT bypass security: the CacheManager
  short-circuits only the provider; firewall/PII/validator still run (IOS-006/007).
- The embedder SHALL be deterministic and provider-independent.

## Dependencies

- IOS-007 (CacheStore / registry / resolver / manager), IOS-005 (event bus),
  conforms to IOS-004, IOS-006, IOS-008 · AS-001 · Constitution v1.0.

## Conformance Requirements

1. `SemanticCacheStore` SHALL register through `CacheRegistry` (after exact-match).
2. A similar request (≥ threshold, same group) SHALL hit without invoking the
   provider and SHALL return the matched cached response.
3. A dissimilar request SHALL miss and fall through to the provider.
4. Requests in different compatibility groups SHALL NOT match.
5. The confidence threshold SHALL be enforced.
6. An exact repeat SHALL hit the exact store and SHALL NOT consult the semantic
   store.
7. Semantic events and metrics SHALL be produced; a disabled similarity policy
   SHALL make the store inert.
8. The CacheManager, Execution Pipeline, and PromptCache middleware SHALL be
   unmodified; all existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001, ADR-0002. No new ADR required: IOS-009 uses the IOS-007 extension
  contract (no architectural change).

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/cache/semantic-embedder.ts`, `semantic-types.ts`,
  `semantic-events.ts`, `semantic-cache-store.ts`, `semantic-metrics.ts`,
  `semantic-bootstrap.ts`; registered in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/semantic-cache.test.ts`.
