# RUN-008 — Output Materializers

| Field | Value |
|-------|-------|
| Identifier | RUN-008 |
| Version | 0.1 |
| Status | Draft |
| Authority | Normative Specification |
| Owner | LAWRENCE Architecture Council |
| Effective Date | — (Draft) |
| Superseded By | — |
| Related Artifacts | AS-003, ADR-0005, RUN-002, RUN-005, RUN-006 |

> Normative Specification skeleton. Terminology follows RFC-2119. No implementation
> until ratified and ADR-0005 approved.

## Purpose

Define the **`OutputMaterializer`** and **materialization sink** model: the separable
seam that persists (or projects) a processor's contract-conformant output, decoupling
"compute" from "persist" so the same processor can run with different sinks across
runtimes — always through governed, audited, tenant-scoped persistence.

## Scope

- The `OutputMaterializer` contract and `MaterializationSink` abstraction.
- The separation of computation from materialization.
- Governed persistence guarantees (audit, permissions, tenant scope, markings).

## Non-Goals

- SHALL NOT introduce hidden side effects or direct store writes; all persistence SHALL
  route through existing kernel persistence and guards (AS-003 R6).
- SHALL NOT bypass Security, clearance (RUN-006), or redaction.
- SHALL NOT define a new storage engine.

## Normative Requirements

- **RUN-008/1.** Computation and materialization SHALL be separable: a processor SHALL be
  executable to produce a contract-conformant output **without** materializing it
  (e.g. preview/dry-run), and materialization SHALL be an explicit, injected step.
- **RUN-008/2.** An `OutputMaterializer` SHALL validate output against its `OutputContract`
  (RUN-002) before persistence; non-conformant output SHALL be rejected with a typed
  Runtime Exception (RUN-009), never silently written.
- **RUN-008/3.** All persistence SHALL route through existing kernel persistence,
  `requirePermission` guards, tenant scoping, and `emitAudit`. A materializer SHALL NOT
  write directly to a store or bypass an access decision (AS-003 R6; Art. V).
- **RUN-008/4.** Materialization SHALL enforce governance markings and clearance (RUN-006)
  and SHALL apply redaction where required; it SHALL NOT weaken an existing deny.
- **RUN-008/5.** Materialization SHALL be idempotent under the processor's incremental
  semantics (RUN-005): re-materializing an unchanged output SHALL not create duplicates.
- **RUN-008/6.** Materialization SHALL emit lineage/provenance via the existing mechanism
  (Art. VII) and SHALL NOT alter the computed output (no observation-by-materialization
  mutation, AS-003 R8).
- **RUN-008/7 (SHOULD).** A sink SHOULD be selectable per `RuntimeProfile` (RUN-004) to
  support distributed/serverless targets without changing the processor.
- **RUN-008/8 (MAY).** A no-op / preview sink MAY be provided for inspection, mirroring
  existing non-persistent pipeline preview behavior.

## Proposed Public Surface (illustrative)

`OutputMaterializer`, `MaterializationSink`, `MaterializationResult`, `PreviewSink`.

## Dependency Direction

Depends on RUN-002 (output contract), RUN-005 (idempotency), RUN-006 (markings), and
kernel persistence/audit/permission contracts. Lower layers SHALL NOT depend on RUN-008.

## Compatibility with AS-001 / IOS

Independent of IOS. A processor that produced output via an inference call still
materializes through this governed seam; the IOS cache/security boundary is unaffected
and SHALL NOT be bypassed (Art. V: "a cache SHALL NOT bypass security").

## Additive-Only Constraints

New seam over existing persistence; `runAssetPipeline` and existing writers unchanged;
materialization opt-in.

## Conformance Hooks

- C1: a processor can compute output without materializing (compute/persist split).
- C2: every materialization emits an audit event and respects ACL + tenant scope.
- C3: non-conformant output is rejected, not written.
- C4: re-materializing unchanged output creates no duplicates (idempotence).
- C5: materialization never broadens access vs. the Security + clearance decision.

## Dependencies

Constitution v1.0; AS-003; RUN-002; RUN-005; RUN-006; kernel persistence/audit/permissions.

## Open Questions

- Whether sinks are a closed set or a registry-extensible contract.
- How preview/dry-run interacts with markings on partially-redacted previews.
