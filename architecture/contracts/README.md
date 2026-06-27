# Public Contracts

| Field | Value |
|-------|-------|
| Identifier | CONTRACTS-INDEX |
| Version | 1.0 |
| Status | Active |
| Authority | Governance Reference |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-27 |
| Derived From | LAWRENCE Constitution v1.0, AS-001 |

> A **Public Contract** is the stable interface a Normative Specification exposes
> for consumers to depend on. Contracts sit below Specifications and above
> Implementations: a Specification defines a contract; an Implementation realizes
> it; consumers depend on the contract, not the implementation. Terminology
> follows RFC-2119.

## Principle

- A consumer SHALL depend on a Public Contract, never on an implementation detail.
- A contract SHALL change only through a Specification revision and an ADR.
- A contract SHALL be provider-independent and SHALL NOT leak vendor specifics.

## Current Public Contracts (defined by their specifications)

| Contract | Specification | Surface |
|----------|---------------|---------|
| Provider Registry | IOS-001 | `ProviderRegistry`, `RegisteredProvider`, `ProviderMetadata` |
| Model Capability | IOS-002 | `ModelDescriptor`, `CapabilitySet` |
| Routing | IOS-003 | `RoutingRequest`, `RoutingPolicy`, `RoutingDecision`, `route()` |
| Execution | IOS-004 | `executeInference`, `runModelCompletion`, `ExecutionHook`, `InferenceExecutionResult`, `ExecutionError` |
| Event Bus | IOS-005 | `ExecutionEventBus`, `BusEvent`, `ExecutionEvent`, `ExecutionEventSubscriber` |
| Security | IOS-006 | `SecurityPolicy`, security middleware, security events |
| Cache | IOS-007 | `CacheManager`, `CacheStore`, `CachePolicy`, cache events |

These contracts are **described** here and **specified** in their IOS documents;
the authoritative definition is the specification. Extracting machine-checkable
contract artifacts (e.g. typed contract modules) is future work governed by a
later ADR.
