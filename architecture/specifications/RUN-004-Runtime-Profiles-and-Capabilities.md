# RUN-004 — Runtime Profiles and Capabilities

| Field | Value |
|-------|-------|
| Identifier | RUN-004 |
| Version | 0.2 |
| Status | Draft |
| Authority | Normative Specification (Constitutional Runtime Contract) |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, RUN-000, ADR-0005 |

> Constitutional runtime contract. Normative sections define **what must be true**, not
> how. Implementation guidance appears only under Implementation Notes (non-normative).
> Terminology follows RFC-2119. No implementation until ratified and ADR-0005 approved.

## Purpose

Define the canonical **`RuntimeProfile`**, **`RuntimeRequirement`**, and
**`RuntimeCapability`** model by which a processor declares what it needs from an
execution host and a host advertises what it offers, so the same processor runs unchanged
across lightweight, distributed, GPU, serverless, automation, and human-review runtimes.

## Scope

**In scope:** `RuntimeRequirement` (what a processor needs); `RuntimeCapability` (what a
host provides); `RuntimeProfile` (the immutable matched binding); `RuntimeClass`; the
deterministic matching obligation.

**Out of scope (Non-Goals):** reusing or aliasing the IOS model `Capability` /
`CapabilitySet` (model features); implementing a scheduler or provisioning infrastructure.

## Canonical Object Contract

### Objects Owned
- `RuntimeRequirement` — a processor's declared execution-host needs.
- `RuntimeCapability` — a host's declared execution-host offerings.
- `RuntimeProfile` — the immutable binding selecting a runtime for a run.
- `RuntimeClass` — `lightweight | distributed | gpu | serverless | automation | human_review`.

### Objects Consumed (and their authoritative producer)
| Consumed object | Authoritative producer |
|---|---|
| processor's declared `RuntimeRequirement` | RUN-001 (declared on the contract) |
| host's advertised `RuntimeCapability` | runtime host (external/declared) |

### Objects Produced → Authorized Consumers
| Produced object | Authorized consumers |
|---|---|
| `RuntimeProfile` | RUN-003 (carries ref), RUN-007 (per-node overrides), RUN-008 (sink selection) |
| `RuntimeRequirement` / `RuntimeCapability` / `RuntimeClass` | RUN-004 matcher, RUN-010 |

## Normative Interfaces

- **RUN-004/1.** A `RuntimeRequirement` SHALL be declarable per processor and SHALL
  describe execution-host needs (e.g. compute class, locality, concurrency, budget,
  accelerator, durability).
- **RUN-004/2.** A `RuntimeCapability` SHALL be declared by a host and SHALL describe what
  the host offers in the same terms.
- **RUN-004/3.** A `RuntimeProfile` SHALL be the result of matching a requirement set
  against host capabilities and SHALL record the matched requirements and capabilities.

## Runtime Invariants

- **INV-004.1 (Declared, not inferred).** `RuntimeCapability` SHALL NOT be inferred from a
  host's name; both requirement and capability SHALL be declared (Art. III).
- **INV-004.2 (Deterministic matching).** Identical declarations against identical host
  capabilities SHALL select the same `RuntimeProfile`.
- **INV-004.3 (Immutability & auditability).** A resolved `RuntimeProfile` SHALL be
  immutable and SHALL retain the matched requirement/capability evidence (Art. VII).
- **INV-004.4 (Portability).** A `RuntimeProfile` SHALL embed no host-specific live handle;
  the contract SHALL remain transport- and locality-agnostic.
- **INV-004.5 (No silent downgrade).** An unsatisfiable requirement SHALL raise a typed
  `CapabilityMismatchFault` (RUN-009); the run SHALL NOT downgrade to an unsafe host.
- **INV-004.6 (Capability namespacing).** `RuntimeCapability` SHALL remain distinct from
  the IOS model `Capability`/`CapabilitySet` and SHALL NOT be interchanged with it.

## Conformance Requirements

- **RUN-004/C1.** Identical declarations select identical profiles (determinism).
- **RUN-004/C2.** Unsatisfiable requirements raise a typed fault; no silent downgrade.
- **RUN-004/C3.** A profile carries no non-serializable handle.
- **RUN-004/C4.** RUN-004 does not reference or alias IOS `Capability`/`CapabilitySet`
  (AS-003 R10).

## Related Specifications

RUN-000, RUN-001 (declares requirement), RUN-003 (carries profile), RUN-007, RUN-008.

## Related ADRs

ADR-0005 (establishing).

## Implementation Notes (non-normative)

- Likely shape: `interface RuntimeProfile { class; matched: { requirement; capability };
  attributes }`.
- Profiles SHOULD compose with existing resource governance (agent run limits, cost
  budgets) rather than duplicate it.
- Optional (preferred-but-not-required) requirements MAY be expressed; hosts MAY advertise
  optional capabilities.
