# Milestone 5.5 — Execution Event Bus

Decouples **observation** from **middleware implementation**. Milestone 5.0
registered telemetry / audit / health as three independent middleware that each
re-derived events from the execution lifecycle. This milestone introduces a
canonical publish/subscribe seam so observers depend only on **events** — never
on each other, on a specific collector, or on the execution context.

```
Execution Pipeline
   ↓
Execution Event Bus            (one publisher middleware → the bus)
   ↓
Subscribers: Telemetry · Metrics · Audit · Health   (priority-independent peers)
```

## What changed

- **One middleware, not four.** A single `ExecutionEventPublisher` middleware is
  registered into the execution hook chain. It builds each canonical event
  exactly once and publishes it to the bus. Telemetry, metrics, audit, and
  health are now **bus subscribers**, not middleware.
- **Self-describing events.** Canonical events were enriched so a subscriber
  needs nothing but the event: each carries `routingDecision`,
  `requestFingerprint`, `startTime`; completed/failed additionally carry
  `responseFingerprint`, `latency`, and (completed) `usage` / (failed)
  normalized `error` + `retryable`. Audit therefore builds its immutable record
  straight from the event.
- **Future middleware subscribes to events** rather than importing telemetry or
  the collectors.

## The bus contract (deliberately minimal)

| Property | Guarantee |
|----------|-----------|
| publish/subscribe | `subscribe(subscriber) → unsubscribe`; `publish(event)` fans out |
| immutable events | events are deep-frozen on construction |
| subscriber ordering | **priority-independent** — subscribers are peers; none may assume order |
| delivery | **synchronous** — `publish()` returns after all subscribers ran |
| isolation | each delivery is `guard()`-wrapped: a throwing subscriber cannot affect a peer or execution |
| retries / persistence / async queue / external brokers | **none** |

## Why behavior is unchanged

The publisher and every subscriber are observation-only and `guard()`-wrapped, so
no observer can mutate the request/response or turn a success into a failure.
Observability still reads the wall clock, never the deterministic monotonic
clock, so id/timestamp sequences are untouched. The provider call, the routing
decision, and the normalized result are byte-for-byte identical with or without
the bus attached — proven by the `provider invocation unchanged` and
`result identical with and without observation` tests.

## Files

- `observability/execution-event-bus.ts` — the bus (pub/sub, synchronous, guarded).
- `observability/event-bus-publisher.ts` — the single bridge middleware.
- `observability/execution-events.ts` — enriched canonical events.
- `observability/{telemetry-engine,metrics-collector,audit-engine,health-collector}.ts`
  — now `ExecutionEventSubscriber`s.
- `observability/observability-bootstrap.ts` — builds the bus, subscribes the
  four observers, registers the one publisher.
- `tests/unit/execution-observability.test.ts` — bus + subscriber + unchanged-execution tests.

## Constraints honored

No routing changes · no provider changes · no execution behavior changes ·
additive only · all existing tests pass (full unit suite green).
