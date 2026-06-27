# Conformance Suites

Executable architectural verification for LAWRENCE Normative Specifications.
Established (structure only) by Milestone 8.0 — see
`/architecture/conformance/conformance-framework.md` for the governing framework.

Each suite SHALL verify the **Conformance Requirements** of its specification and
SHALL NOT define behavior (the specification is authoritative).

```
ios/
    provider-registry/   ← IOS-001 Provider Registry, IOS-002 Model Capability Registry
    routing/             ← IOS-003 Governed Routing
    execution/           ← IOS-004 Execution Pipeline
    middleware/          ← IOS-004 hook / middleware ordering
    telemetry/           ← IOS-005 Execution Event Bus & Observability
    security/            ← IOS-006 Security Middleware
    cache/               ← IOS-007 Cache Platform
```

> Status: structure only. No suites are populated in this milestone. Existing
> tests under `tests/unit` and `tests/integration` remain the de-facto conformance
> evidence and SHALL NOT be moved or changed here; their migration/linking is
> future work governed by a later ADR.
