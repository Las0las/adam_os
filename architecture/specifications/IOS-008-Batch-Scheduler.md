# IOS-008 — Batch Scheduler

| Field | Value |
|-------|-------|
| Identifier | IOS-008 |
| Version | 1.0 |
| Status | Active |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Superseded By | — |
| Related Artifacts | IOS-003, IOS-004, IOS-005, IOS-006, IOS-007, DD-001 |

## Purpose

The Batch Scheduler SHALL group compatible inference requests into deterministic
batches to improve throughput, while preserving correctness, security,
observability, and every execution contract. It is an execution capability of the
Inference Operating System and introduces NO architectural change (AS-001 R4: a
capability attaches as execution middleware).

## Scope

Governs the Batch Scheduler, Batch Queue, Batch Policy, Batch Coordinator, Batch
Metrics, and Batch Events. It does NOT introduce provider-specific batching
beyond the published single-request provider abstraction (IOS-001/004): a "batch"
is a coordinated *scheduling* group, not a wire-level multi-request call.

## Responsibilities

- Queue compatible requests; determine batch eligibility.
- Dispatch a batch when it reaches `maxBatchSize` (reason "size") or its wait
  timer fires (reason "timeout").
- Release each request to continue down the pipeline so it proceeds — in order —
  through Prompt Firewall → PII Redaction → Provider → Response Validator.
- Guarantee each request receives its own correct response (deterministic
  response mapping).
- Publish canonical batch events and collect passive batch metrics.

## Public Interfaces

- `BatchScheduler` (execution middleware via `resolveCompletion`).
- `BatchPolicy`, `BatchPolicyStore` (immutable): enabled, maxBatchSize,
  maxWaitMs, supportedWorkloads, supportedProviders, supportedModels, bypass.
- `BatchQueue`, `BatchCoordinator`.
- Batch events (`created`, `queued`, `dispatched`, `completed`, `expired`,
  `bypassed`); `isBatchEvent`.
- `BatchMetricsCollector`.

## Architectural Placement & Integration

Execution order SHALL be: Prompt Cache → **Batch Scheduler** → Prompt Firewall →
PII Redaction → Provider → Response Validator → Event Publisher (priorities:
cache 0, batch 0.5, firewall 1, PII 2, validator 3, publisher 10).

The scheduler attaches through the existing IOS-004 `resolveCompletion` hook (no
new pipeline capability). Because the cache's `resolveCompletion` short-circuits
the resolve loop on a hit, the scheduler is never consulted for cache hits. On a
cache miss the scheduler HOLDS the request until its batch dispatches, then
returns `null` — so the request continues normally through security and the
provider. The scheduler therefore coordinates only *timing*; it never returns a
response and never invokes the provider itself.

## Invariants

The Batch Scheduler SHALL preserve: request isolation, response ordering,
execution determinism, middleware contracts, routing decisions, and
auditability. It SHALL NOT: modify routing, modify provider selection, bypass
security, bypass telemetry, bypass audit, or bypass validation. Batch policies
SHALL be immutable during execution. With batching disabled (default) the
scheduler SHALL be a no-op and behavior SHALL be identical to its absence.

## Dependencies

- IOS-004 (resolveCompletion hook), IOS-005 (event bus), IOS-007 (cache ordering
  / hit short-circuit), conforms to IOS-003 and IOS-006 · AS-001 · Constitution
  v1.0.

## Conformance Requirements

1. A single request SHALL execute correctly (immediate dispatch at size 1).
2. Compatible requests SHALL be grouped into one batch; each SHALL receive its
   own correct response.
3. Incompatible requests (differing provider/model/workload/response-format)
   SHALL NOT share a batch.
4. A batch SHALL dispatch at `maxBatchSize` and on `maxWaitMs` timeout.
5. Bypass and disabled policies SHALL NOT batch; disabled SHALL emit no events.
6. The canonical batch events SHALL be published; metrics SHALL be collected.
7. Middleware order SHALL be cache → batch → firewall → PII → provider →
   validator → publisher.
8. Security and validation SHALL run for every request, including batched ones.
9. Existing execution behavior SHALL be unchanged for non-batched requests; all
   existing tests SHALL pass unchanged.

## Related ADRs

- ADR-0001 (governance framework), ADR-0002 (v1.0 freeze). No new ADR required:
  IOS-008 fits the frozen architecture via the existing middleware contract.

## Derived From

- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By

—

## Implementation References

- `src/lib/aiops/batch/*` (batch-types, batch-events, batch-queue,
  batch-coordinator, batch-scheduler, batch-metrics, batch-bootstrap);
  wired in `src/lib/lawrence-core/bootstrap.ts`.
- Conformance: `tests/unit/batch-scheduler.test.ts` (until migrated to
  `/conformance/ios/execution` per the Conformance Framework).
