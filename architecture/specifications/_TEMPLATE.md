# IOS-NNN — <Title>

<!--
  Normative Specification template. Every IOS specification SHALL use this
  template and SHALL populate every section. Terminology follows RFC-2119
  (SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY). A specification is an
  ARCHITECTURAL artifact — it defines contracts and invariants, not
  implementation detail (implementation is referenced, not reproduced).
-->

| Field | Value |
|-------|-------|
| Identifier | IOS-NNN |
| Version | 1.0 |
| Status | Draft \| Active \| Superseded |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | YYYY-MM-DD |
| Superseded By | — |
| Related Artifacts | <ADRs, sibling specs> |

## Purpose
<!-- Why this subsystem exists; the constitutional need it satisfies. -->

## Scope
<!-- What is governed by this specification, and explicitly what is not. -->

## Responsibilities
<!-- The obligations this subsystem SHALL fulfill. -->

## Public Interfaces
<!-- The stable contracts consumers depend on (types/functions/events), described
     normatively. Reference the contract, do not reproduce implementation. -->

## Canonical Object Contract
<!-- NORMATIVE and MANDATORY for every IOS specification. It is a binding part of
     the specification (not just documentation): it fixes ownership and dependency
     direction so the specification library stays internally consistent as the
     Intelligence Layer grows. Every specification SHALL populate all five fields.

     Two object classes:
     - Shared Canonical Contracts define reusable object taxonomies and are NEVER
       directly produced (they have NO canonical producer), e.g. `Recommendation`.
     - Canonical Objects are concrete realizations owned by EXACTLY ONE
       specification (their canonical producer), e.g. `CostRecommendation` (IOS-019).
     A specification that produces a member of a taxonomy SHALL produce exactly one
     concrete Canonical Object and SHALL reuse (not redefine) the Shared Canonical
     Contract it specializes. -->

- **Canonical Objects Consumed** — canonical platform objects this subsystem reads
  (by reference, never mutating), e.g. ExecutionPlan, RoutingDecision,
  ProviderHealthSnapshot, Explanation, BenchmarkResult, ReplayResult.
- **Canonical Objects Produced** — canonical objects this subsystem authors and
  owns (it becomes their canonical producer).
- **Existing Contracts Reused** — published contracts/APIs reused without change
  (e.g. IOS-004 executeInference, IOS-005 event bus, IOS-003 routing).
- **Authoritative Producers** — for each consumed object, the subsystem that owns
  it (authority direction; consumers SHALL NOT redefine or mutate it).
- **Authorized Consumers** — who MAY read the objects this subsystem produces.

## Invariants
<!-- Properties that SHALL always hold. -->

## Dependencies
<!-- Upstream specifications/standards this depends on (authority direction only:
     never depends on a lower layer). -->

## Conformance Requirements
<!-- Observable, testable requirements a conformant implementation SHALL satisfy.
     Each SHOULD map to a future conformance suite. -->
<!-- MANDATORY Canonical Object Contract conformance — every specification SHALL
     include testable requirements proving:
     (a) consumed canonical objects are treated as READ-ONLY (never mutated);
     (b) produced canonical objects are owned EXCLUSIVELY by this specification
         (it is their sole canonical producer);
     (c) authority is NEVER inverted (a consumer never assumes a producer's role);
     (d) dependency direction follows AS-001 (no dependency on a lower layer);
     (e) implementations cannot mutate canonical objects they do not own. -->

## Related ADRs
<!-- ADRs that established or amended this specification. -->

## Derived From
- LAWRENCE Constitution v1.0
- AS-001 Inference Operating System

## Superseded By
<!-- Newer specification version, or — -->

## Implementation References
<!-- Pointers into the codebase that currently realize this specification. These
     are descriptive, not authoritative: the specification governs the code. -->
