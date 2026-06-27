# ASSESS-001 — Processor Runtime Specification: Additive-Safety Architectural Assessment

| Field | Value |
|-------|-------|
| Identifier | ASSESS-001 |
| Version | 1.0 |
| Status | Assessment (non-normative) |
| Authority | Pre-specification analysis (informs a future AS + RUN-NNN specs + ADR) |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Subject | Adding a Palantir-style **Processor Runtime Specification** layer |
| Related Artifacts | CONST-LAWRENCE v1.0, AS-001, ADR-0002, ADR-0003, ADR-0004, DD-001 |

> This is an **assessment only**. No code, contract, or architecture is changed by
> this document. It evaluates whether the proposed concepts can be introduced in a
> purely additive, non-breaking, scalable way, and recommends a governed path.
> Terminology follows RFC-2119 where it describes obligations of the *proposed* layer.

---

## 0. Executive Summary — GO (conditional, additive-only)

**Recommendation: GO**, as a **new sibling subsystem** governed by a **new Architecture
Standard** and a new `RUN-NNN` specification family — **NOT** as an extension of the
frozen Inference Operating System (IOS).

The proposed concepts (ProcessorContract, Input/Output Contracts, ExecutionContext,
RuntimeProfile, RuntimeCapability, IncrementalSemantics, GovernanceMarkings/
ClearancePolicy, OutputMaterializer, PipelineRegistry, RuntimeException taxonomy,
Conformance tests) can be introduced **additively and safely**, because:

- They map onto the **DataOps / pipeline / ontology** plane, which today runs in code
  but is **not yet governed by any Architecture Standard** (only AS-001 = IOS exists).
  There is therefore a genuine, unfilled architectural slot for them.
- The existing registry, context, capability, policy, and observability patterns are
  consistent and **composable**, so the new layer can wrap them through adapters
  without editing stable modules.
- No proposed type name is an exact collision with an existing exported symbol.

**This GO is conditional on four hard guardrails** (detailed in §7–§9):

1. **Do not touch IOS.** ADR-0003 declared the IOS execution-extension architecture
   *complete*; the Processor Runtime SHALL consume IOS as a downstream caller and SHALL
   NOT add an IOS `ExecutionHook`/`aroundInvoke` seam, nor alter IOS-004.
2. **Qualify four overloaded names** to avoid semantic collisions: `ExecutionContext`,
   `Capability`, `Classification`, `Policy` (see §6).
3. **Respect authority direction** (Constitution Art. I): the new layer is a *higher*
   layer — it may depend down onto IOS / DataOps / Security, never the reverse, and the
   kernel (`lawrence-core`) SHALL NOT depend on it.
4. **Follow DD-001 governance before code.** Because this establishes a *new
   architecture layer/standard*, it requires a Specification + an ADR (Constitution
   Art. VI) **before** implementation. This document is the pre-spec input, not the spec.

---

## 1. Repository Findings Summary

LAWRENCE is a TypeScript / Next.js platform with an unusually formal "constitutional"
governance stack layered over a working AIOps + DataOps + Mission-Control codebase.

**Governance plane (`/architecture`, `/conformance`)**
- `CONST-LAWRENCE v1.0` — supreme, frozen. Key invariants: one-directional authority
  (Constitution → Standards → Specs → Contracts → Implementations → Conformance);
  **immutable dependency direction (lower depends on higher, never the reverse)**;
  additive evolution; provider independence; deterministic/observable execution;
  capabilities attach as middleware/subscribers, never by editing the core.
- `AS-001` — the **only** Architecture Standard. Governs the **Inference Operating
  System (IOS)** *only* (provider registry, routing, execution pipeline, event bus,
  security, cache). Explicitly does **not** govern application/domain logic or
  persistence except as IOS consumers.
- `IOS-001 … IOS-013` — normative specs for the IOS subsystems.
- `ADR-0003` — established the general `aroundInvoke` provider-invocation seam and
  **declared the IOS execution-extension architecture complete** ("no further execution
  extension point SHALL be introduced unless … an existing published extension contract
  is insufficient").
- `ADR-0004` — Execution Plan: routing owns target selection/authorization; execution
  owns invocation; middleware owns policy but SHALL NOT invent/authorize targets.
- `DD-001` — Specification-First Development. Code SHALL NOT redesign architecture;
  architecture changes require an ADR first. **Names a `RUN-NNN` ("Runtime") spec prefix
  as a reserved example** — a natural home for this layer.
- `/conformance/ios/<area>` — directory scaffold; suites map 1:1 to spec Conformance
  Requirements. Existing `tests/unit` + `tests/integration` are the de-facto conformance
  evidence and SHALL NOT be moved/changed.

**Implementation plane (`/src/lib`)**
- `aiops/` — IOS implementation: `execution` (pipeline, hooks, errors, observability),
  `routing`, `providers`, `models`, `functions`, `agents`, `retry`, `circuit`,
  `fallback`, `health`, `cache`, `batch`, `security`, `evals`, `learning`.
- `dataops/` — **the true home of the proposed layer**: `transforms`, `pipelines`,
  `parsers`, `ontology`, `lineage`, `evidence`, `ingestion`, `import`, `sources`.
- `security/` — data classification, ACL/RBAC/ABAC, redaction, retention, compliance,
  audit integrity.
- `mission-control/` — runtime components, actions/commands, approvals, review-queue,
  deployments, readiness, observability traces.
- `lawrence-core/` — kernel: db, audit hash-chain, permissions, ids, bootstrap.

**Decisive structural fact:** the proposed concepts are **DataOps/pipeline concepts**,
and the DataOps plane is the part of the platform **not yet covered by a Standard**.
This is why the layer is additive rather than intrusive — it fills an empty governed
slot rather than overlapping AS-001.

---

## 2. Existing Concepts Discovered (what already exists / partially exists)

| Proposed concept | Closest existing artifact(s) | State |
|---|---|---|
| **ProcessorContract** | `PipelineTransform` (`dataops/transforms/transform-types.ts`: `{key,label,run(input,ctx)}`); `LawrenceFunction<I,O>` (`aiops/functions/function-types.ts`: `{key,name,klass,outputSchema,run}`); `ParserHandler`, `ObjectMapper`, `ActionHandler`, `ImportAdapter` | **Partial.** Several narrow "runnable unit" contracts exist, each per-domain. No *unified* processor contract spanning them. |
| **InputContract / InputSetContract** | `TransformInput {rows,config}`; `CompletionRequest`; `RoutingRequest`; function input typed generically | **Partial/none.** Inputs exist but with no declared schema/cardinality/validation contract. |
| **OutputContract / OutputSetContract** | `TransformOutput {rows,metadata}`; `FunctionExecutionResult<O> {output,citations,trace}`; `CanonicalParseOutput`; `PipelineRunResult` | **Partial/none.** Outputs exist; no formal output schema/cardinality/guarantee contract. |
| **ExecutionContext** | `InferenceExecutionContext` (IOS-004, immutable, widely referenced); `FunctionExecutionContext {tenantId,actorUserId}`; `TransformContext {tenantId,actorUserId}`; `ActorContext` (platform) | **Exists under different names.** Bare `ExecutionContext` is unused but the *concept* is heavily occupied → **HIGH collision risk** (§6). |
| **RuntimeProfile** | `RuntimeComponent` / `RuntimeComponentType` (`mission-control/runtime`); the `*Policy` + `*PolicyStore` family (retry/circuit/fallback/health/cache/batch) | **None by that name.** Runtime classification + immutable policy snapshots exist; no per-processor runtime profile. |
| **RuntimeCapability** | `CapabilitySet` (6 booleans: vision/tools/streaming/json/reasoning/embeddings) + `type Capability = keyof CapabilitySet` (IOS-002) | **Exists for *models*.** `Capability` is taken and means *model* capability → **HIGH collision risk** (§6). |
| **IncrementalSemantics** | Ontology upsert + append-only ledger (`ontology/object-service.ts`, idempotent on `objectType+externalKey`); SHA-256 ingest dedup; `LineageEvent` provenance | **Partial.** Idempotent/append behaviors exist; no formal full-vs-incremental / delta / snapshot semantics. |
| **GovernanceMarkings / ClearancePolicy** | `DataClassification` (9 sensitivity levels), `DataClassificationRecord`, `ObjectAccessPolicy`, `AccessDecision {allowed,redactions,requiredApproval}`, `SecurityContext {roleKeys,permissions,attributes}` | **Partial.** Rich classification + access policy + redaction exist. No "markings + clearance" model, but the hooks to add it cleanly are present. |
| **OutputMaterializer** | `runAssetPipeline` writes records/objects/chunks/lineage inline; `ObjectMapper`; `projectSubmissionRecord`; `RuntimeTrace` | **None.** Materialization is implicit/inline; no separable "compute vs. persist" materializer. |
| **PipelineRegistry** | `PipelineDefinition`/`PipelineRun` (data model only); per-concept registries: transform, parser, object-mapper, import-adapter, function, provider, action | **None by that name.** No registry of *pipelines*; many sibling registries exist as a proven pattern. |
| **RuntimeException taxonomy** | `ExecutionError` base + 8 subclasses + closed `ExecutionErrorKind` + `normalizeError()`/`isRetryable()` | **Exists for IOS (closed set).** No DataOps/processor taxonomy; extend-by-subclass is the safe path. |
| **Conformance tests** | `/conformance/ios/*` scaffold; `tests/unit/architecture-*.test.ts` (additive-equivalence proofs) | **Pattern exists.** New `/conformance/run/*` area + `architecture-*`-style equivalence tests fit directly. |
| Observability/event bus (supporting) | `ExecutionEventBus` (multi-family pub/sub), `RuntimeTrace`, audit hash-chain | **Exists, reusable** as subscribers — never to be edited. |

---

## 3. Gap Analysis

**Genuine gaps the layer would fill (additive value):**
1. **No unified processor abstraction.** Transforms, functions, parsers, mappers,
   actions, and import-adapters are independent contracts. There is no common
   `ProcessorContract` describing "a governed runnable unit with declared inputs,
   outputs, capabilities, and runtime profile."
2. **No declared I/O contracts.** Inputs/outputs are structurally typed but carry no
   schema/cardinality/validation contract → no static conformance, no set semantics.
3. **No incremental semantics.** Re-runs are independent; idempotent upserts approximate
   it but there is no first-class full/incremental/snapshot/delta model.
4. **No materialization seam.** "Compute" and "persist" are fused inside
   `runAssetPipeline`; nothing lets a processor be executed without writing, or
   re-targeted to a different sink (GPU/serverless/distributed runtimes need this).
5. **No pipeline registry / runtime-profile catalog.** Pipelines are data rows, not
   registered runnable artifacts with declared runtime requirements.
6. **No clearance/markings model.** Classification + access policy exist, but
   propagation of markings onto *derived* outputs (transform lineage) and a
   clearance-gating policy are absent.

**Non-gaps (already solved — must reuse, not re-implement):**
- Event bus, audit hash-chain, RuntimeTrace observability.
- Provider independence, routing/execution plan, IOS resilience middleware.
- RBAC/ABAC, redaction, retention, tenant isolation, permission guards.
- Idempotent ontology upsert + lineage provenance.

---

## 4. Additive-Safe Architecture Recommendation

**Shape:** a new, self-contained **Processor Runtime** subsystem that sits **above**
DataOps primitives and **beside** (consuming, never extending) the IOS. It is a
*specification + adapter* layer: new contracts that **wrap** existing transforms/
functions/pipelines via adapters, leaving every stable module untouched.

**Governance shape (per DD-001 / Constitution Art. VI):**
- A new **Architecture Standard** — proposed `AS-00X — Processor Runtime` (sibling to
  AS-001; AS-002 appears reserved by DD-001 examples for Enterprise Ontology). It must
  derive authority from the Constitution and SHALL NOT contradict AS-001.
- A new normative **specification family** under the reserved `RUN-NNN` prefix, e.g.:
  - `RUN-001` Processor Contract & Runtime Context
  - `RUN-002` Input/Output (Set) Contracts
  - `RUN-003` Runtime Profile & Capability Model
  - `RUN-004` Incremental Semantics
  - `RUN-005` Output Materializer
  - `RUN-006` Pipeline Registry
  - `RUN-007` Governance Markings & Clearance Policy
  - `RUN-008` Runtime Exception Taxonomy
- An **ADR** establishing the new layer and its dependency direction (required because
  a new architecture layer is established — Art. VI / DD-001).

**Implementation shape (when approved):**
- New code root: `src/lib/runtime/` (or `src/lib/processor-runtime/`) — a **new top-level
  lib peer**, not nested under `aiops` or `dataops`, to keep dependency direction clean
  and to avoid implying it is part of IOS or DataOps primitives.
- **Adapters, not edits:** `ProcessorContract` implementations that wrap existing
  `PipelineTransform`, `LawrenceFunction`, `ObjectMapper`, etc. The originals keep their
  signatures and tests.
- **Reuse by subscription:** emit to the existing `ExecutionEventBus` and `RuntimeTrace`;
  never modify them.
- **Bootstrap by additive registration:** add one side-effect import to
  `lawrence-core/bootstrap/register-platform-runtime.ts` (already the sanctioned, additive
  registration aggregation point) — this is the *only* existing file the rollout needs to
  touch, and only by appending an import line.

**Why this is non-breaking:**
- Every new symbol is new; existing exports are unchanged.
- The materializer/registry/profile are *opt-in*: a transform not wrapped behaves exactly
  as today.
- Equivalence is provable the same way ADR-0003 proved `aroundInvoke`: "with no processor
  wrapper registered, behavior is byte-for-byte the prior behavior."

---

## 5. Proposed File / Module Locations (when implemented — not now)

```
architecture/
  standards/      AS-00X-Processor-Runtime.md
  specifications/ RUN-001 … RUN-008-*.md
  adr/            ADR-00NN-establish-processor-runtime-layer.md
conformance/
  run/            contract/ io/ profile/ incremental/ materializer/ registry/
                  markings/ exceptions/   (READMEs + suites, 1:1 to RUN reqs)
src/lib/runtime/                          # new top-level peer (NOT under aiops/dataops)
  contract/       processor-contract.ts        # ProcessorContract, ProcessorKind
  context/        processor-runtime-context.ts  # ProcessorRunContext (qualified name)
  io/             io-contracts.ts               # InputContract, OutputContract, *Set*
  profile/        runtime-profile.ts            # RuntimeProfile, RuntimeRequirement
                  runtime-capability.ts         # RuntimeCapability (compute/locality)
  incremental/    incremental-semantics.ts      # IncrementalSemantics, SnapshotMode
  materializer/   output-materializer.ts        # OutputMaterializer, MaterializationSink
  registry/       pipeline-registry.ts          # PipelineRegistry (global-singleton pattern)
  governance/     governance-markings.ts        # GovernanceMarking, MarkingSet
                  clearance-policy.ts           # ClearancePolicy, ClearanceDecision
  errors/         runtime-exceptions.ts         # RuntimeException taxonomy
  adapters/       transform-processor-adapter.ts # wraps PipelineTransform
                  function-processor-adapter.ts  # wraps LawrenceFunction
  bootstrap.ts                                   # registerProcessorRuntime() (idempotent)
```

Touchpoint into existing code: **one appended import** in
`src/lib/lawrence-core/bootstrap/register-platform-runtime.ts`. Nothing else edited.

---

## 6. Proposed Interface Names (collision-safe)

Verified against current exports. Bare names that **collide semantically** are
qualified; all others are clear.

| Proposed (raw) | Verdict | Recommended name |
|---|---|---|
| `ProcessorContract` | Clear | `ProcessorContract` |
| `InputContract` / `InputSetContract` | Clear | keep |
| `OutputContract` / `OutputSetContract` | Clear | keep |
| `ExecutionContext` | **HIGH collision** (`InferenceExecutionContext`, `FunctionExecutionContext`, `TransformContext`, `ActorContext` already occupy the concept) | **`ProcessorRunContext`** (or `ProcessorExecutionContext`) |
| `RuntimeProfile` | Clear (concept-adjacent to `*Policy`/`RuntimeComponent`) | `RuntimeProfile` |
| `RuntimeCapability` | **HIGH collision** (`Capability = keyof CapabilitySet` means *model* capability) | **`RuntimeCapability`** is OK *only if* clearly distinct (compute/locality/concurrency), never reusing `CapabilitySet`; otherwise `RuntimeRequirement` |
| `IncrementalSemantics` | Clear | keep |
| `GovernanceMarkings` | Clear (`DataClassification` is distinct) | `GovernanceMarking` / `MarkingSet` |
| `ClearancePolicy` | **MEDIUM** (`Policy` heavily used: `SecurityPolicy`, `RetentionPolicy`, `ObjectAccessPolicy`, `ApprovalPolicy`, `CachePolicy`…) | `ClearancePolicy` acceptable (qualified by `Clearance`); avoid bare `Policy` |
| `OutputMaterializer` | Clear | keep |
| `PipelineRegistry` | Clear (no existing `PipelineRegistry`; sibling registries exist) | keep |
| `RuntimeException` | Clear-ish (`ExecutionError` exists) | `RuntimeException` base **must not** shadow/replace `ExecutionError`; for processor faults prefer `ProcessorException extends RuntimeException` |
| (do NOT introduce) `Processor`, `Function`, `Context`, `Capability`, `Policy`, `Pipeline` as bare exports | **Forbidden** | always compound-qualify |

`Classification` must **not** be reused for clearance — it already means data sensitivity.

---

## 7. Dependency Direction Analysis

Constitution Art. I.4: *dependency direction is immutable; lower layers depend on higher
layers, never the reverse.* In implementation terms (Next.js import graph) the rule is:
**stable/lower modules SHALL NOT import the new layer.**

Proposed (allowed) import direction — new layer depends **downward/outward** onto stable
contracts:

```
src/lib/runtime/  ──imports──▶  aiops (IOS public contracts: executeInference, events)
                  ──imports──▶  dataops (PipelineTransform, registries, lineage)
                  ──imports──▶  security (classification, access-guard)
                  ──imports──▶  lawrence-core (db, audit, permissions, ids)   [kernel]
```

**Hard rules for the new layer (must be enforced by an architecture test):**
1. `lawrence-core/**` SHALL NOT import `runtime/**` (kernel stays below everything). The
   one exception — `register-platform-runtime.ts` — is the sanctioned *aggregation* file
   whose entire job is additive side-effect registration; it already imports peer
   registries, so appending one import preserves the established pattern and does **not**
   constitute kernel→domain coupling of logic.
2. `aiops/**`, `dataops/**`, `security/**` SHALL NOT import `runtime/**` (no lower→higher).
3. `runtime/**` SHALL NOT import experience/domain/app modules (`app/**`,
   `domains/**`) — it is platform, not experience; coupling platform to experience would
   invert authority (violates "no coupling lower platform/kernel to higher domain/
   experience modules").
4. `runtime/**` depends only on **public contracts** of IOS/DataOps/Security, never on
   their internal files (mirrors the "depend on contracts, not implementations" principle).

**Circular-dependency risk:** **LOW**, provided rules 1–3 hold. The only realistic cycle
is via bootstrap; it is broken because bootstrap uses *side-effect imports for
registration*, and the runtime layer registers itself rather than being referenced by
lower modules.

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Treating this as an IOS extension (new `ExecutionHook`/`aroundInvoke`) — violates ADR-0003 "extension architecture complete" | Med | **High** | Build as a sibling subsystem; consume `executeInference` as a caller; **zero** edits to `aiops/execution`. |
| R2 | `ExecutionContext` / `Capability` / `Classification` / `Policy` semantic collisions cause confusion or accidental shadowing | High | Med | Use qualified names (§6); add a lint/architecture test forbidding bare re-exports of these identifiers from `runtime/**`. |
| R3 | Dependency inversion — a lower module imports `runtime/**` | Med | **High** | Architecture test (extend `tests/unit/architecture-*.test.ts` style) asserting no lower→higher / kernel→runtime imports. |
| R4 | Hidden side effects in materializer (writes that bypass audit/permissions/tenant guards) | Med | **High** | Materializer SHALL route all persistence through existing `lawrence-core/db` + `requirePermission` + `emitAudit`; no direct writes. Conformance test: "materialization emits audit + respects ACL." |
| R5 | Over-coupling: `ProcessorContract` swallowing `LawrenceFunction`/`PipelineTransform` and pressuring their signatures | Med | Med | Adapters only; originals unchanged; equivalence test "unwrapped transform == today." |
| R6 | Governance bypass: markings/clearance becoming a second, divergent access path next to `object-policy-engine` | Med | **High** | Clearance evaluation SHALL compose with (not replace) `evaluateObjectAccess`; deny-override semantics preserved; never weakens an existing deny. |
| R7 | Constitutional process skipped (code before spec/ADR) — DD-001 violation | Med | **High** | This assessment → Spec(s) → ADR → approval → code. Do not implement from this doc. |
| R8 | Scalability assumptions baked into contract (e.g., assuming in-process execution) | Low | Med | Keep `RuntimeProfile`/`OutputMaterializer` transport-agnostic; see §10. |
| R9 | Determinism/observability regressions (Art. IV) — processor wrapping perturbs clocks/ids or makes observation mutate execution | Low | **High** | Reuse immutable context + existing event bus; observers remain read-only; conformance test for observation-safety. |
| R10 | Closed IOS error taxonomy conflated with open processor taxonomy | Low | Med | `RuntimeException` is a **separate** hierarchy; never re-map or widen `ExecutionErrorKind`. |
| R11 | Conformance debt — new contracts without suites | Med | Med | Each `RUN-NNN` requirement maps 1:1 to a `/conformance/run/**` assertion before merge (mirrors §2 of conformance framework). |

---

## 9. Test / Conformance Strategy

1. **Additive-equivalence proofs (highest priority).** Mirror
   `tests/unit/architecture-around-invoke.test.ts` / `architecture-execution.test.ts`:
   - "With no processor wrapper registered, DataOps pipeline output is byte-for-byte the
     current `runAssetPipeline` output."
   - "A pass-through `ProcessorContract` over a `PipelineTransform` yields identical
     rows/metadata to invoking the transform directly."
2. **Dependency-direction tests.** Static import-graph assertions: no
   `lower → runtime/**`; no `runtime/** → app|domains`; `runtime/**` imports only public
   contract entrypoints.
3. **No-collision tests.** Assert `runtime/**` does not export bare `ExecutionContext`,
   `Capability`, `Classification`, `Policy`, `Processor`, `Function`, `Pipeline`.
4. **Governance/safety conformance.** Materialization emits audit + enforces ACL +
   tenant scoping; clearance composes with `evaluateObjectAccess` and never relaxes a
   deny; markings propagate onto derived outputs via lineage.
5. **Observation safety (Art. IV/AS-001 R5).** Event emission cannot turn success into
   failure and cannot mutate inputs/outputs.
6. **Incremental semantics.** Full vs. incremental runs are deterministic and idempotent;
   re-running with unchanged input produces no duplicate materialization.
7. **Suite placement.** `/conformance/run/<area>`, 1:1 with each `RUN-NNN` Conformance
   Requirement. Existing `tests/**` remain untouched (de-facto IOS conformance evidence).

---

## 10. Scalability Across Runtimes

The contract must be **transport- and locality-agnostic** so the same `ProcessorContract`
runs under different `RuntimeProfile`s without contract change:

| Runtime | Fit | Required design property |
|---|---|---|
| **Lightweight (in-process)** | Native | Default profile = synchronous, in-memory; equals today's `runAssetPipeline`. |
| **Distributed** | Good | `OutputMaterializer` separates compute from persist; `RuntimeProfile` declares partitioning/concurrency; context carries no in-process handles. |
| **GPU** | Good | `RuntimeCapability` declares accelerator/compute needs (distinct from model `CapabilitySet`); scheduler matches profile→host. Contract stays pure data-in/out. |
| **Serverless** | Good | No long-lived registry handles in context; `PipelineRegistry` rebuildable from side-effect imports (existing global-singleton survives bundling); idempotent materialization tolerates retries. |
| **Automation** | Native | Maps to existing `ActionHandler`/`executeAction` (idempotency keys, approval gates) — processor wraps, does not replace. |
| **Human-review** | Native | Maps to existing `ReviewCase` + `awaiting_approval` lifecycle; `ClearancePolicy` + `requiredApproval` already model the gate. |

Scalability risk is **low** *iff* the contract forbids embedding execution-host
assumptions (R8): inputs/outputs are serializable data, context is immutable metadata,
materialization is an injected sink.

---

## 11. Constitutional / ADR / IOS Compatibility

- **Art. I (authority direction):** Compatible — new layer is higher; §7 enforces it.
- **Art. II (additive evolution):** Compatible — pure addition; no signature changes;
  governed by ADR.
- **Art. III (provider independence):** Compatible — layer is provider-agnostic; uses
  declared capabilities; routes inference through IOS only.
- **Art. IV (deterministic, observable, single-path execution):** Compatible **iff**
  inference still flows solely through `executeInference` (R1) and observation stays
  read-only (R9). The Processor Runtime SHALL NOT become a second provider-invocation
  path.
- **Art. V (governed capability attachment):** Compatible — governance markings/clearance
  attach as evaluation that *composes with* existing security; SHALL NOT reroute/mutate
  provider behavior; SHALL NOT let a cache or materializer bypass security.
- **Art. VI (change process):** Requires Spec → ADR → approval → conformance **before
  code** (R7).
- **Art. VII (traceability):** Compatible — RUN-NNN reqs trace to suites; reuse audit
  hash-chain + RuntimeTrace.
- **AS-001 / ADR-0003 / ADR-0004:** Compatible **only** as a downstream consumer. Do not
  add IOS hooks; do not re-run routing; do not invent execution targets.
- **Event sourcing / projection model:** The platform emits events + audit but is **not**
  event-sourced (no event log as source of truth). `OutputMaterializer` should align with
  the existing idempotent-upsert + lineage projection model, not introduce a competing
  event-sourcing substrate.

---

## 12. GO / NO-GO

**GO — conditional, additive-only, governed.**

Proceed **only** in this order:
1. Ratify this assessment.
2. Author `AS-00X — Processor Runtime` + the `RUN-001…008` specifications (contracts &
   invariants, no implementation).
3. Raise and approve an **ADR** establishing the layer, its dependency direction, and its
   non-extension of IOS (Constitution Art. VI / DD-001).
4. Implement adapters + new modules under `src/lib/runtime/`, touching exactly one
   existing file (`register-platform-runtime.ts`, append-only).
5. Land `/conformance/run/**` suites 1:1 with RUN requirements, including the
   additive-equivalence and dependency-direction proofs.

**NO-GO conditions (any one blocks):**
- Implementing before the Spec + ADR exist (DD-001 violation).
- Any new IOS `ExecutionHook`/`aroundInvoke` or edit to `aiops/execution/**`
  (ADR-0003 violation).
- Any lower/kernel module importing `runtime/**` (Art. I violation).
- Materialization or clearance that bypasses audit, permissions, tenant scope, or weakens
  an existing access deny (Art. V violation).
- Reusing bare `ExecutionContext` / `Capability` / `Classification` / `Policy` /
  `Function` / `Pipeline` identifiers.

The proposal is **safe and valuable as a new, additive, governed subsystem**. It is
**unsafe** only if forced into the frozen IOS or implemented ahead of its specification —
both avoidable by following the path above.
