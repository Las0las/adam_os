# AS-001 — Inference Operating System

| Field | Value |
|-------|-------|
| Identifier | AS-001 |
| Version | 1.0 |
| Status | Active |
| Authority | Architecture Standard |
| Owner | LAWRENCE Architecture Council |
| Effective Date | 2026-06-26 |
| Derived From | LAWRENCE Constitution v1.0 |
| Superseded By | — |
| Related Artifacts | IOS-001 … IOS-007, ADR-0001 |

> An Architecture Standard sits between the Constitution and Normative
> Specifications. It SHALL refine constitutional principles into binding rules for
> a coherent subsystem, and SHALL itself derive authority from the Constitution.
> Terminology follows RFC-2119.

## 1. Purpose

AS-001 establishes the **Inference Operating System (IOS)**: the governed
subsystem through which all model inference in LAWRENCE is selected, executed,
observed, secured, and optimized. It places the IOS beneath the Constitution and
above the IOS Normative Specifications (IOS-001 … IOS-007).

## 2. Scope

This Standard governs the IOS layers:

1. Provider Foundation & Provider Platform (registry, descriptors, capabilities)
2. Governed Routing
3. Execution Pipeline (the single provider-invocation path)
4. Execution Observability & Event Bus
5. Security Middleware
6. Cache Platform

It does NOT govern application/domain logic, persistence, or UI, except insofar
as they consume the IOS public contracts.

## 3. Binding Rules

- **R1 (Single Path).** All inference SHALL flow through the Execution Pipeline.
  No component outside the pipeline and the provider layer SHALL invoke a provider.
- **R2 (Registry Authority).** The Provider Registry SHALL be the single source of
  truth for which providers and models exist, how they authenticate, what they
  cost, and what they can do. Capabilities SHALL be declared per model.
- **R3 (Governed Routing).** Provider/model selection SHALL be produced by the
  Routing Engine as an immutable RoutingDecision, derived only from declared
  capabilities and declarative policy — never from a provider's name.
- **R4 (Attachment).** Observability, security, and caching SHALL attach as
  execution middleware or event-bus subscribers. They SHALL NOT modify providers,
  routing, or applications.
- **R5 (Observation Safety).** Observation SHALL NOT alter execution and SHALL NOT
  perturb deterministic clocks or identifiers.
- **R6 (Security Boundary).** Security middleware MAY inspect/validate/reject/
  redact; it SHALL NOT reroute, retry, optimize, or mutate provider behavior. A
  cache SHALL NOT bypass security middleware.
- **R7 (Immutability).** Execution contexts, routing decisions, execution results,
  events, and cached responses SHALL be immutable once produced.
- **R8 (Specification-First).** Each IOS subsystem SHALL be defined by a versioned
  Normative Specification; implementations SHALL derive authority only through the
  Constitution and this Standard.
- **R9 (Provider-Invocation Contract).** Execution middleware MAY participate in
  provider invocation through the general **AroundInvoke** execution contract
  defined by IOS-004. This contract is provider-independent and SHALL be used by
  execution-control middleware that requires provider invocation governance. It is
  a permanent, general execution extension point — not a retry-specific mechanism:
  IOS-010 (Retry Policy) is its first consumer, and execution-control middleware
  such as IOS-011 (Circuit Breaker), IOS-012 (Fallback Orchestrator), and IOS-013
  (Provider Health Manager) SHALL reuse it without further architectural change.

## 4. Governed Specifications

| Specification | Subsystem | Source Milestones |
|---------------|-----------|-------------------|
| IOS-001 | Provider Registry | 2.0 |
| IOS-002 | Model Capability Registry | 2.0 |
| IOS-003 | Governed Routing | 3.0 |
| IOS-004 | Execution Pipeline | 4.0, 4.5 |
| IOS-005 | Execution Event Bus & Observability | 5.0, 5.5 |
| IOS-006 | Security Middleware | 6.0 |
| IOS-007 | Cache Platform | 7.0, 7.5 |
| IOS-008 | Batch Scheduler | (Phase 2) |
| IOS-009 | Semantic Cache | (Phase 2) |
| IOS-010 | Retry Policy | (Phase 2) |
| IOS-011 | Circuit Breaker | (Phase 2) |

## 5. Conformance

Each governed Specification SHALL declare Conformance Requirements and SHALL
eventually be backed by an executable conformance suite under `/conformance/ios`.

## 6. Authority

AS-001 derives all authority from the LAWRENCE Constitution v1.0. AS-001 SHALL NOT
contradict the Constitution. Amendments SHALL be recorded as ADRs.
