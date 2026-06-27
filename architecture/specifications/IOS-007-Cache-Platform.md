# IOS-007 — Cache Platform

| Field | Value |
|-------|-------|
| Identifier | IOS-007 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-004, IOS-005, IOS-006, ADR-0001 |

## Purpose

The Cache Platform SHALL provide deterministic execution caching as a pluggable
subsystem, so future cache strategies plug in without modifying the execution
pipeline (Constitution, Article V). Covers Milestones 7.0 (exact-match prompt
cache) and 7.5 (unified platform).

## Scope

Governs the CacheManager, CacheRegistry, CacheResolver, the CacheStore contract,
the ExactMatchCacheStore, the immutable CachePolicy, cache events, and cache
metrics. Excludes semantic cache, embeddings, distributed/Redis stores,
persistence, and adaptive eviction (future CacheStore implementations +
specifications + ADRs).

## Responsibilities

- The pipeline SHALL communicate only with the **CacheManager** (via the
  PromptCache middleware entry point that delegates to it).
- The **CacheManager** SHALL own policy evaluation, store selection (via the
  **CacheResolver** over the **CacheRegistry**), lookup, write-through store, and
  event publication.
- A **CacheStore** SHALL implement `lookup/store/remove/clear/statistics`,
  perform its own keying, and remain transport-agnostic (no event-bus dependency;
  methods MAY be async).
- **ExactMatchCacheStore** SHALL provide exact-match keying (provider, model,
  normalized request, response format, maxTokens), TTL, hit counting, immutable
  entries, and capacity eviction.

## Public Interfaces

- `CacheManager`, `CacheRegistry`, `CacheResolver`, `CacheStore`,
  `ExactMatchCacheStore`, `PromptCache` (compat middleware).
- `CachePolicy`, `CachePolicyStore` (enabled, ttl, maxEntries, workload/provider/
  model filters, cache-store selection, bypass).
- Cache events (`hit`, `miss`, `store`, `expired`, `store_selected`,
  `lookup_started`, `lookup_completed`); `isCacheEvent`.
- `CacheMetricsCollector`.

## Invariants

- The pipeline SHALL NOT know the cache type, implementation, ordering, or storage
  mechanism; there SHALL be no `cacheType`/`cacheStoreType` branching in the
  pipeline. Only the CacheRegistry knows which stores exist.
- A cache hit SHALL short-circuit ONLY the provider call; the firewall, PII
  redaction, and response validator SHALL still run (a cache SHALL NOT bypass
  security).
- Cached responses SHALL be immutable; failures SHALL NOT be cached.
- Lookup SHALL be deterministic and SHALL return the first valid hit in a
  deterministic store order.
- The CachePolicy SHALL be immutable during an execution; default policy is
  disabled (no-op).

## Dependencies

- IOS-004 (resolve/record hooks), IOS-005 (event bus), IOS-006 (security ordering)
  · AS-001 · Constitution v1.0.

## Conformance Requirements

1. An identical request SHALL hit and SHALL NOT invoke the provider.
2. Adding a new `CacheStore` SHALL require only implement + register + configure —
   no pipeline change (demonstrated by a custom store serving hits).
3. A cache hit SHALL still execute firewall and validator.
4. A disabled or bypassed policy SHALL emit no cache events and SHALL invoke the
   provider every time.

## Related ADRs

- ADR-0001.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/cache/*` (cache-manager, cache-registry, cache-resolver,
  cache-store, exact-match-cache-store, prompt-cache, cache-types, cache-events,
  cache-metrics, cache-bootstrap).
