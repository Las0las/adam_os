# RUN-004 — Runtime Profiles and Capabilities

| Field | Value |
|-------|-------|
| Identifier | RUN-004 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-001, RUN-003, RUN-008 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define **`RuntimeProfile`**, **`RuntimeRequirement`**, and **`RuntimeCapability`**: the
declarative model by which a processor states what it needs from an execution host, and
by which a host advertises what it offers, so the same processor runs unchanged across
lightweight, distributed, GPU, serverless, automation, and human-review runtimes.

## Scope

- `RuntimeRequirement`: what a processor requires (compute class, locality, concurrency,
  budget, accelerator, durability).
- `RuntimeCapability`: what a runtime host provides.
- `RuntimeProfile`: a named, immutable binding selecting a runtime for a processor run,
  with matching rules between requirement and capability.

## Non-Goals

- SHALL NOT reuse or alias the IOS model `Capability` / `CapabilitySet` (which describe
  *model* features such as vision/tools/streaming). `RuntimeCapability` is about
  *execution-host* capability and SHALL remain distinct (AS-003 R10).
- SHALL NOT implement a scheduler or provision infrastructure; it defines the contract a
  scheduler would honor.

## Normative Requirements

- **RUN-004/1.** A processor SHALL declare a `RuntimeRequirement` set (RUN-001/3).
  Undeclared requirements SHALL resolve to the most conservative runtime, never the most
  powerful or most permissive.
- **RUN-004/2.** A `RuntimeProfile` SHALL be immutable once resolved and SHALL record the
  matched requirements and capabilities for auditability (AS-003 R9, Art. VII).
- **RUN-004/3.** Requirement→capability matching SHALL be deterministic: identical
  declarations against identical host capabilities SHALL select the same profile.
- **RUN-004/4.** A profile SHALL NOT embed host-specific live handles; the contract SHALL
  remain transport- and locality-agnostic so execution can occur in-process, remote,
  serverless, or accelerated without contract change (AS-003 scalability goal).
- **RUN-004/5.** `RuntimeCapability` SHALL NOT be inferred from a host's name; it SHALL be
  declared (mirrors Constitution Art. III "declared, never inferred").
- **RUN-004/6.** A run whose requirements cannot be satisfied SHALL raise a typed Runtime
  Exception (RUN-009) and SHALL NOT silently downgrade to an unsafe host.
- **RUN-004/7 (SHOULD).** Profiles SHOULD compose with existing resource governance
  (e.g. agent run limits, cost budgets) rather than duplicate it.
- **RUN-004/8 (MAY).** A host MAY advertise optional capabilities; processors MAY declare
  optional (preferred-but-not-required) requirements.

## Proposed Public Surface (illustrative)

`RuntimeProfile`, `RuntimeRequirement`, `RuntimeCapability`, `RuntimeClass`
(`lightweight | distributed | gpu | serverless | automation | human_review`),
`matchProfile()`.

## Dependency Direction

Depends on RUN-001/003 contracts only. Lower layers SHALL NOT depend on RUN-004.

## Compatibility with AS-001 / IOS

No overlap with IOS model capabilities; the two capability concepts are namespaced apart
and never interchanged.

## Additive-Only Constraints

New types; no edit to IOS `CapabilitySet`; opt-in.

## Conformance Hooks

- C1: identical declarations select identical profiles (determinism).
- C2: unsatisfiable requirements raise a typed exception, no silent downgrade.
- C3: a profile carries no non-serializable handle.
- C4: RUN-004 does not reference or alias IOS `Capability`/`CapabilitySet`.

## Dependencies

Constitution v1.0; AS-003; RUN-001; RUN-003.

## Open Questions

- Canonical `RuntimeClass` enumeration and whether it is open/closed.
- Whether GPU/accelerator requirements are first-class fields or opaque key/values.
