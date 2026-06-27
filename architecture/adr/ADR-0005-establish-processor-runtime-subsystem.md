# ADR-0005 — Establish the Processor Runtime as a Sibling Governed Subsystem

| Field | Value |
|-------|-------|
| Identifier | ADR-0005 |
| Status | Draft (Proposed) |
| Date | — (Draft) |
| Owner | LAWRENCE Architecture Council |
| Affected Artifacts | New: AS-003, RUN-001 … RUN-010 |
| Supersedes | — |
| Superseded By | — |
| Related Artifacts | CONST-LAWRENCE v1.0, AS-001, ADR-0003, ADR-0004, DD-001, ASSESS-001 |

## Title

Establish a **Processor Runtime (RUN)** subsystem — a Palantir-style transform/processor
contract layer — as a **new, additive, sibling governed subsystem** beneath the
Constitution and beside the Inference Operating System (AS-001). The Processor Runtime
consumes the IOS downstream and SHALL NOT extend, wrap, or modify any IOS execution seam.

## Status

**Draft (Proposed).** Skeleton only. This ADR records the *intent and boundary* of the
new subsystem so that AS-003 and RUN-001 … RUN-010 may be authored under DD-001. No
implementation SHALL begin until this ADR is approved and the specifications are ratified.

## Context

ASSESS-001 evaluated introducing a Processor Runtime Specification layer
(ProcessorContract, Input/Output Contracts, ProcessorRunContext, Runtime Profiles,
RuntimeCapability, Incremental Semantics, Governance Markings / Clearance, Pipeline
Registry, Output Materializers, Runtime Exception taxonomy, Conformance) and concluded
**GO**, conditional on the layer being a sibling subsystem.

Two constraints make an ADR mandatory (DD-001 / Constitution Art. VI):

1. **A new architecture layer is being established.** Only AS-001 (the IOS) exists as an
   Architecture Standard; the DataOps/pipeline plane on which these concepts live is not
   yet governed by a Standard. Creating AS-003 establishes architecture and therefore
   requires an approved ADR before code.
2. **The boundary against IOS must be recorded normatively.** ADR-0003 declared the IOS
   execution-extension architecture *complete*. Any new runtime layer risks being
   mistaken for an IOS extension; this ADR fixes it as a downstream consumer.

## Decision

1. **Create AS-003 — Processor Runtime Architecture Standard**, deriving authority from
   the Constitution and not contradicting AS-001.
2. **Create the RUN-NNN specification family** (RUN-001 … RUN-010) governed by AS-003.
3. **Boundary (normative):**
   - The Processor Runtime SHALL be a sibling subsystem, not an IOS extension.
   - It SHALL NOT modify AS-001, IOS-004, the `ExecutionHook`/`aroundInvoke` contract,
     or any file under `aiops/execution/**`.
   - It SHALL obtain inference solely by calling the published IOS public contract
     (`executeInference`) as a downstream caller; it SHALL NOT invoke providers directly
     and SHALL NOT become a second provider-invocation path.
4. **Additive-only (normative):** every RUN artifact SHALL be additive; no rename, move,
   deletion, or weakening of existing public contracts or tests. With no processor
   registered or wrapped, all existing behavior and tests SHALL be byte-for-byte
   unchanged.
5. **Authority direction (normative):** the Processor Runtime is a higher layer; lower
   layers (IOS, DataOps, Security, kernel) SHALL NOT depend on it. The kernel SHALL NOT
   import Processor Runtime modules except the sanctioned additive registration
   aggregation point, append-only.
6. **Naming (normative):** RUN artifacts SHALL use `ProcessorRunContext` (not
   `ExecutionContext`), `RuntimeCapability` / `RuntimeRequirement` (not bare
   `Capability`), `GovernanceMarking` / `Clearance*` kept distinct from Security
   `Classification`, and qualified `*Policy` names.

## Alternatives Considered

- **Extend IOS-004 with a processor hook.** Rejected: violates ADR-0003 (extension
  architecture complete) and Art. IV (single inference path); couples a data/computation
  abstraction to the inference invocation seam.
- **Add the concepts inside `dataops/**` without a Standard.** Rejected: DD-001 forbids
  establishing architecture from code; the concepts span governance, runtime, and
  materialization and warrant a governed Standard.
- **Fold into a future Enterprise Ontology Standard (AS-002).** Rejected for now: the
  Processor Runtime is broader than ontology; it MAY later depend on AS-002 for
  ontology-typed outputs (OQ in AS-003) but should not be subordinate to it.
- **No new subsystem.** Rejected: ASSESS-001 identified genuine, unfilled gaps (unified
  processor contract, declared I/O, incremental semantics, materialization seam,
  clearance markings) with clear additive value.

## Consequences

- A governed home for processor/transform contracts that scales across runtimes without
  touching the IOS.
- One new Architecture Standard, one spec family, and (later) a new `src/lib/runtime/**`
  implementation root touching exactly one existing file (the registration aggregation
  point, append-only).
- A normative boundary that prevents future drift into the frozen IOS.

## Compatibility Analysis (asserted; to be demonstrated at implementation)

- **Completely additive.** New Standard, new specs, new implementation root; no existing
  signature, file, or test changes.
- **IOS untouched.** No new execution extension point; `aiops/execution/**` unmodified;
  ADR-0003 and ADR-0004 preserved.
- **Dependency direction preserved.** Lower layers do not reference the Processor Runtime;
  kernel isolation maintained except the append-only registration import.
- **Equivalence.** With no processor registered/wrapped, behavior and tests are unchanged
  — RUN-010 SHALL require an executable additive-equivalence proof.

## Conformance Impact

RUN-010 SHALL define conformance suites under `/conformance/run/<area>`, 1:1 with each
RUN specification's Conformance Requirements, including: additive-equivalence,
dependency-direction (no lower→runtime imports), no-collision (no bare reserved
identifiers), governed-materialization (audit + ACL + tenant), governance-composition
(clearance never relaxes a deny), and observation-safety.

## Open Questions

- Final AS number (AS-003 proposed; AS-002 reserved by DD-001 example).
- Final ADR number on acceptance (ADR-0005 proposed; next free integer).
- Implementation root path (`src/lib/runtime/` vs `src/lib/processor-runtime/`).

## Approval

— (Draft; not yet approved. Approval establishes AS-003 and authorizes RUN-001 … RUN-010.)
