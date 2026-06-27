# Conformance Framework

| Field | Value |
|-------|-------|
| Identifier | CONF-FRAMEWORK |
| Version | 1.0 |
| Status | Active |
| Authority | Governance Reference |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Derived From | LAWRENCE Constitution v1.0, AS-001 |

> Every Normative Specification SHALL eventually be backed by an executable
> conformance suite that verifies its Conformance Requirements against the
> implementation. This milestone establishes the framework and directory
> structure only; it does NOT migrate existing tests. Terminology follows
> RFC-2119.

## 1. Location

Conformance suites SHALL live under `/conformance/ios/<area>`:

```
/conformance/ios/
    provider-registry/   ← IOS-001, IOS-002
    routing/             ← IOS-003
    execution/           ← IOS-004
    middleware/          ← IOS-004 hook/middleware ordering
    telemetry/           ← IOS-005
    security/            ← IOS-006
    cache/               ← IOS-007
```

## 2. Mapping

Each suite SHALL map 1:1 to the **Conformance Requirements** enumerated in its
specification. A requirement `IOS-NNN/§k.j` SHALL correspond to at least one
executable assertion.

## 3. Authority

A conformance suite verifies but does NOT define behavior: the Specification is
authoritative. Where a suite and a specification disagree, the suite is wrong and
SHALL be corrected (or an ADR raised against the specification).

## 4. Migration (future work — out of scope here)

Existing tests under `tests/unit` and `tests/integration` already exercise much of
the IOS behavior (e.g. `architecture-execution.test.ts`,
`inference-pipeline.test.ts`, `routing-engine.test.ts`,
`execution-observability.test.ts`, `security-middleware.test.ts`,
`prompt-cache.test.ts`, `cache-platform.test.ts`). A future ADR SHALL govern their
migration/linking into the conformance suites. Until then, those tests remain the
de-facto conformance evidence and SHALL NOT be moved or changed by this milestone.

## 5. Status

The directory structure exists with placeholders. No suites are populated in this
milestone; population is future work per §4.
