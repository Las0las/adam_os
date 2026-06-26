# Milestone 7.0 — Prompt Cache Middleware

Deterministic, **exact-match** in-memory caching, implemented entirely as
execution middleware. Repeated identical requests return the same immutable
execution result without invoking a provider — **without ever bypassing the
security middleware**. No semantic cache, no embeddings, no persistence, no
routing or provider changes.

```
Execution Pipeline
   │ BeforeExecute (observe)
   ▼
Prompt Cache  ── lookup (resolveCompletion, on the ORIGINAL request) ──┐ hit?
   ▼                                                                    │
Prompt Firewall ─ PII Redaction  (security still runs on every request)│
   ▼                                                                    │
Provider  ◀── skipped on a hit ─────────────────────────────────────────┘
   ▼
Response Validator  (runs on cached AND fresh responses)
   ▼
Prompt Cache  ── store (recordCompletion, fresh + validated only) ──▶ Event Bus
   ▼
Event Publisher → Telemetry / Audit / Metrics / Cache Metrics
```

## The cache never bypasses security

This is the central guarantee. The cache adds two lifecycle steps to the
pipeline:

- `resolveCompletion(request, ctx)` runs **first**, on the original request, and
  may return a cached response — but it only **short-circuits the provider**. The
  request interceptors (firewall, PII) and the response interceptor (validator)
  **still run** around a cache hit. A prompt that the firewall now blocks is
  rejected even if it is cached; a cached response is re-validated against the
  current policy.
- `recordCompletion(request, response, ctx)` runs **after** the response passes
  validation, so **failures and invalid responses are never cached**.

Keying on the *original* (pre-redaction) request avoids a correctness trap: two
distinct prompts that PII-mask to the same text must not collide.

## Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | **Prompt Cache** — in-memory exact-match; full key (provider, model, normalized request, response format, …) | `cache/prompt-cache.ts` |
| 2 | **CachePolicy** — disabled/enabled, ttl, maxEntries, cacheable workloads, bypass; immutable store | `cache/cache-types.ts` |
| 3 | **CacheEntry** — key, immutable response, created/expires timestamps, hit count | `cache/cache-types.ts` |
| 4 | **Cache Middleware** — lookup before provider, store after validation, never cache failures | `cache/prompt-cache.ts` |
| 5 | **Cache Events** — `cache.hit` / `cache.miss` / `cache.store` / `cache.expired` on the Execution Event Bus | `cache/cache-events.ts` |
| 6 | **Cache Metrics** — hit/miss rate, evictions, entry count, average lookup time (passive) | `cache/cache-metrics.ts` |
| 7 | **Middleware ordering** — cache(0) → firewall(1) → PII(2) → provider → validator(3) → publisher(10) | `cache/cache-types.ts` (`CACHE_PRIORITY`) |
| 8 | **Tests** | `tests/unit/prompt-cache.test.ts` |

## Cache key

The full, collision-free key (a deterministic, sorted-key serialization) includes
**provider, model, the normalized request prompt, response format / tool
definitions (`outputSchema`), and maxTokens** — no partial keys. (The platform's
`CompletionRequest` folds the system prompt into `prompt` and expresses response
format / tools as `outputSchema`; temperature / top_p are not fields on the
request type and are absent — additional fields are picked up automatically as
the request type grows.) Normalization is minimal and exact: CRLF→LF and outer
trim only; internal content is preserved verbatim.

## Default is disabled

`installPromptCache()` (wired into runtime bootstrap as the outermost middleware)
applies a **disabled** default policy, so installing it changes nothing — the
cache is a complete no-op until a tenant enables it. This keeps caching opt-in
(it can serve stale results) and guarantees zero behavior change for existing
traffic. Enabling, TTL, max entries, cacheable workloads, and bypass are all
per-policy.

## Verification

- **277 unit + 163 integration = 440 pass / 0 fail** (2 pre-existing skips), the
  cache installed and disabled by default. `next build` green · `tsc` green ·
  gitleaks clean.
- Dedicated tests: identical-prompt hit, different-prompt miss, TTL expiry,
  immutable cached result, bypass, disabled, cacheable-workload filter, event
  publication, failures-not-cached, middleware ordering, and two
  **never-bypass-security** proofs (firewall + validator run on a hit; a hit
  cannot bypass a firewall block introduced after caching).

## Out of scope (later milestones)

Semantic cache · embeddings · distributed cache · persistence · cache warming ·
invalidation beyond TTL · adaptive eviction · compression.
