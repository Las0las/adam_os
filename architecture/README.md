# LAWRENCE Architecture & Governance

This directory holds LAWRENCE's **constitutional governance artifacts**. It is the
authoritative description of the architecture; it contains no runtime code and has
no runtime dependency. Established by Milestone 8.0 (ADR-0001). Terminology
throughout follows RFC-2119 (SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY).

> **Released:** LAWRENCE Architecture **v1.0** (`LAWRENCE-ARCH-1.0`) — see
> `releases/LAWRENCE-ARCH-1.0.md` (approved by ADR-0002).
>
> **Architecture v1.0 is FROZEN** (normative baseline). Architecture Phase 1 is
> **COMPLETE**; Platform Phase 2 is **ACTIVE**. Development is now
> **specification-driven**: future work is identified by specification id (e.g.
> "Implement IOS-008 according to AS-001"), not by milestone number. See
> `governance/architecture-v1.0-freeze-declaration.md` (recorded by ADR-0002).
> The topology SHALL change only via an Architecture Standard revision, an
> approved ADR, or a Constitutional Amendment — never through implementation.

## Authority Hierarchy

```
LAWRENCE Constitution            ← supreme authority (frozen v1.0)
        ↓
Architecture Standards           ← AS-001 Inference Operating System
        ↓
Normative Specifications         ← IOS-001 … IOS-007
        ↓
Public Contracts                 ← stable interfaces consumers depend on
        ↓
Implementations                  ← src/** (governed by, never authoritative)
        ↓
Conformance Suites               ← executable verification (/conformance)
```

Authority flows downward only. No implementation is authoritative; where code and
a specification disagree, the specification governs.

## Directory Map

| Path | Contents |
|------|----------|
| `constitution/` | The frozen LAWRENCE Constitution v1.0 (supreme authority). |
| `standards/` | Architecture Standards (AS-001 Inference Operating System). |
| `specifications/` | Normative Specifications (IOS-001 … IOS-007) + `_TEMPLATE.md`. |
| `directives/` | Development Directives (DD-001 Specification-First Development) + `_TEMPLATE.md`. |
| `adr/` | Architecture Decision Records + `_TEMPLATE.md`. |
| `releases/` | Architectural release manifests (LAWRENCE-ARCH-1.0). |
| `contracts/` | Public Contract index (interfaces consumers depend on). |
| `conformance/` | The Conformance Framework definition. |
| `governance/` | Governance metadata schema. |
| `traceability/` | The bidirectional traceability model. |
| `/conformance/ios/*` (repo root) | Conformance suite structure (placeholders). |

## Specification Index

| Spec | Title | Source Milestones |
|------|-------|-------------------|
| AS-001 | Inference Operating System (Standard) | 2.0 – 7.5 |
| IOS-001 | Provider Registry | 2.0 |
| IOS-002 | Model Capability Registry | 2.0 |
| IOS-003 | Governed Routing | 3.0 |
| IOS-004 | Execution Pipeline | 4.0, 4.5 |
| IOS-005 | Execution Event Bus & Observability | 5.0, 5.5 |
| IOS-006 | Security Middleware | 6.0 |
| IOS-007 | Cache Platform | 7.0, 7.5 |
| IOS-008 | Batch Scheduler | Phase 2 (spec-driven) |
| IOS-009 | Semantic Cache | Phase 2 (spec-driven) |
| IOS-010 | Retry Policy | Phase 2 (spec-driven) |
| IOS-011 | Circuit Breaker | Phase 2 (spec-driven) |
| IOS-012 | Fallback Orchestrator | Phase 2 (spec-driven) |
| IOS-013 | Provider Health Manager | Phase 2 (spec-driven) |
| IOS-014 | Benchmark Harness | Phase 2 (spec-driven) |
| IOS-015 | Explainability Engine | Phase 2 (spec-driven) |
| IOS-016 | Traffic Replay Engine | Phase 2 (spec-driven) |
| IOS-017 | Evaluation Engine | Phase 2 (spec-driven) |
| IOS-018 | Model Capability Registry (impl of IOS-002) | Phase 2 (spec-driven) |
| IOS-019 | Cost Optimization Engine | Phase 2 (spec-driven) |
| IOS-020 | SLA Management | Phase 2 (spec-driven) |

## Working Under Governance (from Milestone 8.0 onward)

Day-to-day development is governed by **DD-001 — Specification-First Development**
(`directives/DD-001-specification-first-development.md`): implementation
originates from an approved specification, references a specification identifier
(not a milestone), preserves conformance, and never redesigns architecture without
an approved ADR.

Every significant change SHALL begin with a versioned Specification and, where it
establishes or changes architecture, an ADR — **before** code. The flow is:

```
Constitution → Architecture Standards → Specifications → ADRs →
Public Contracts → Implementation → Conformance → Published Release
```

The architectural topology is frozen at v1.0. Future work is primarily new
specifications, ADRs, conformance suites, and implementation against published
specifications — not redesigning the topology.
