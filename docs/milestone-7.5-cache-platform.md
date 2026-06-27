# Milestone 7.5 — Unified Cache Platform

Not another cache — a **platform** all current and future caching strategies plug
into without touching the execution pipeline. Milestone 7.0's prompt cache is now
one `CacheStore` (`ExactMatchCacheStore`); the pipeline talks only to a
`CacheManager`. No provider, routing, security, or application changes; additive.

```
Execution Pipeline ──▶ CacheManager  (the ONLY cache the pipeline knows)
                          │ policy eval · store selection · event publication
                          ▼
                      CacheResolver ──▶ CacheRegistry ──▶ CacheStore[]
                                                           └ ExactMatchCacheStore (active)
                                                             SemanticCacheStore   (future)
                                                             RedisCacheStore       (future) …
                          │
                          ▼
                  Execution Event Bus ──▶ Telemetry / Audit / Cache Metrics
```

## The pipeline depends only on cache contracts

The pipeline never knows whether a request is served by an exact map, a semantic
index, Redis, or a future store — it calls the `CacheManager` (via the same
`resolveCompletion` / `recordCompletion` middleware hooks as 7.0). Adding a cache
strategy is purely: **(1) implement `CacheStore`, (2) register it,
(3) configure the policy** — no pipeline, routing, or provider changes.

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | **CacheManager** — lookup, store, policy eval, store selection, event publication; the only component the pipeline talks to | `cache/cache-manager.ts` |
| 2 | **CacheStore** interface — `lookup/store/remove/clear/statistics`, provider-independent, pure (no bus) | `cache/cache-store.ts` |
| 3 | **ExactMatchCacheStore** — the 7.0 prompt cache, refactored into a store; behavior identical | `cache/exact-match-cache-store.ts` |
| 4 | **CacheResolver** — eligible stores + deterministic lookup order + first valid hit | `cache/cache-resolver.ts` |
| 5 | **CachePolicy** — + provider filters, model filters, cache-store selection (immutable) | `cache/cache-types.ts` |
| 6 | **CacheRegistry** — register / enumerate / resolve, registration order preserved | `cache/cache-registry.ts` |
| 7 | **Cache Events** — retained hit/miss/store/expired (now `store`-attributed) + `store_selected` / `lookup_started` / `lookup_completed` | `cache/cache-events.ts` |
| 8 | **Cache Metrics** — + lookup/store latency, per-store hit/miss rate, utilization, eviction rate | `cache/cache-metrics.ts` |
| 9 | **Architecture tests** | `tests/unit/cache-platform.test.ts` |

## Compatibility

`PromptCache` is retained as a thin, backward-compatible facade — a preconfigured
`CacheManager` over a single `ExactMatchCacheStore` with the original
`(bus, policyStore, now)` constructor and `prompt-cache` middleware name. **All 12
Milestone 7.0 prompt-cache tests pass unchanged.** Cache stores are pure (no
event-bus dependency); the manager owns all event publication, so out-of-process
stores (Redis, distributed) — whose `CacheStore` methods may be async — plug in
without pipeline changes.

## Still never bypasses security

Unchanged from 7.0: a cache hit short-circuits only the provider call; the
firewall, PII redaction, and response validator still run on every request. The
manager emits **nothing** when an execution is not cacheable (disabled / bypassed
/ filtered), so the layer is a complete no-op by default.

## Verification

- **289 unit + 163 integration = 452 pass / 0 fail** (2 pre-existing skips),
  including the 12 unchanged 7.0 tests. `next build` green · `tsc` green ·
  gitleaks clean.
- New tests: CacheManager lookup, registry ordering + replace-in-place, resolver
  default + explicit ordering, multi-store first-hit, per-store metrics,
  ExactMatchCacheStore compatibility, immutable cached response, deterministic
  lookup, and **pipeline independence** (a bespoke `CacheStore` the pipeline knows
  nothing about plugs in and serves hits).

## Out of scope (future CacheStore implementations)

Semantic cache · embedding similarity · Redis · distributed cache · replay cache ·
cache warming · compression · adaptive eviction · predictive caching. Each becomes
a `CacheStore` registered on the platform.
