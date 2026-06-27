# LAWRENCE — Platform Vision & Conceptual Architecture

| Field | Value |
|-------|-------|
| Identifier | VISION-001 |
| Version | 1.0 |
| Status | Vision (informative, non-normative) |
| Authority | Conceptual orientation — does not bind implementation |
| Owner | LAWRENCE Architecture Council |
| Date | 2026-06-27 |
| Subject | The governed object/mission/graph model, the plane stack, the core lifecycles, and their mapping to current implementation |
| Related Artifacts | AS-001, AS-003, ONT-001, IOS-001…020, RUN-000…010, Phase 3 Roadmap, ASSESS-003 |

> This is an **informative vision artifact**. It orients the platform's conceptual
> model and maps it to what exists today; it confers no authority and changes no
> architecture. Normative authority lives only in the Constitution, Architecture
> Standards, and approved Specifications/ADRs. Where this document and any approved
> specification disagree, the specification governs. Implementation-status claims are
> a point-in-time snapshot reconciled against **ASSESS-003** (HEAD `28270f0`).

---

## 1. Thesis — beyond chat-first

The dominant pattern for enterprise AI is **chat-first**:

```
Prompt → LLM → Answer
```

It is stateless, ungoverned, and disconnected from enterprise reality: the model has
no durable model of the business, no policy boundary, no audit, and no feedback loop.
The answer evaporates; nothing is learned; nothing is safely acted upon.

LAWRENCE is **governed object/mission/graph-first**. Inference is one bounded step
inside a closed enterprise loop:

```
Enterprise Reality → Ontology → AI → Actions → Reality Changes → Observation → Learning ↺
```

The same loop, expressed operationally:

```
Enterprise State → Mission → Simulation → Decision → Approval → Execution
                 → Observation → Learning → Continuous Improvement ↺
```

Five commitments distinguish the model:

- **Object-first** — work is grounded in canonical enterprise objects, not free text.
- **Graph-first** — objects, relationships, and evidence form a navigable graph.
- **Mission-first** — outcomes are pursued as governed missions with steps, tools,
  and an execution plan, not as one-shot prompts.
- **Governed-first** — every command passes policy evaluation, approval, and audit.
- **AI-enabled** (not AI-led) — reasoning is a routed, observed, replaceable step
  inside the loop, never the unbounded center.

---

## 2. The Plane Stack

The platform is a vertical stack of planes. Each plane consumes the planes beneath it
and exposes a contract upward; authority and dependency flow **downward only**
(consistent with AS-001's dependency direction).

| # | Plane | Owns | Backing subsystem(s) | Status |
|---|-------|------|----------------------|--------|
| 1 | **Experience** | Operator surfaces: command center, object detail, chat, review queues | `src/app/**`, `domains/command-center`, `domains/object-detail`, mission-control review surfaces | **Exists** (demo surfaces across domain packs) |
| 2 | **Mission** | Missions, steps, tools, deployments, approvals, notifications, readiness | `src/lib/mission-control/*` (actions, approvals, deployments, review-queue, readiness, runtime, notifications) | **Exists** |
| 3 | **Decision** | Recommendations, policy evaluation, approval gating, observed outcomes | Recommendation platform (IOS-019 cost, IOS-020 sla), `mission-control/approvals`, `aiops/learning/recommendation-outcome-service` | **Partial** — recommendation + approval mechanics exist; broader decision plane aspirational |
| 4 | **Reasoning** | Model routing, agents, functions/tools, retrieval-augmented reasoning | `aiops/models/model-router`, `aiops/agents/agent-runner`, `aiops/functions/*`, `aiops/retrieval` | **Exists (core)** — reasoning-engine abstraction is thin |
| 5 | **Knowledge** | Evidence, chunking, embeddings, retrieval index | `dataops/evidence/*` (chunking, deterministic embeddings), `aiops/retrieval` | **Partial** — deterministic baseline; production retrieval aspirational |
| 6 | **Ontology** | Canonical objects, identity/merge, relationships, schema | ONT-001 + `dataops/ontology/*` (upsert/merge, links, history, schema registry) | **Warn-only** — 4 canonical types validated, enforcement gated (ADR + AS-004) |
| 7 | **Platform** | The Inference Operating System: routing, execution, providers, security, cache, observability | AS-001 + IOS-001…020 (`src/lib/aiops/*`) | **Complete** |
| 8 | **Runtime** | Governed processor/runtime contracts across heterogeneous compute | AS-003 + RUN-000…010 | **Specified, not implemented** (Draft; ADR-0005 unapproved) |

The Phase 3 roadmap's planes A–E (Intelligence, Optimization, Governance, Runtime
Intelligence, Enterprise Intelligence) are **horizontal capability bands that ride on
top of this vertical stack** — they consume planes 4–7 and feed planes 2–3.

---

## 3. The Reasoning & Model-Routing Spine

Reasoning is deliberately a **routed, replaceable** step — never a hardwired model:

```
Reasoning Engine → Model Router → { Claude · GPT · Gemini · Local Models · Open Models · Future Models }
```

- **Model Router** (`aiops/models/model-router.ts`) selects a provider/model from
  **declared capabilities and declarative policy**, never from a provider's name
  (AS-001 R3). New models are additive — registering a provider/descriptor (IOS-001/
  IOS-018) makes it routable without touching callers.
- **Single inference path** (AS-001 R1): all inference flows through the IOS Execution
  Pipeline (IOS-004). Resilience (retry/circuit/fallback) and observation attach as
  governed middleware (ADR-0003/0004), so reasoning is observed and bounded by
  construction.
- This is why "Future Models" is a first-class box: the router is the seam that keeps
  the platform model-agnostic.

---

## 4. Core Lifecycles

The platform is defined as much by its **loops** as its layers. Each lifecycle below
is grounded in existing or specified subsystems.

### 4.1 Mission lifecycle

```
Create Mission → Steps → Policies → Tools → Execution Plan → Simulation → Deploy
```

- Authored and deployed in the **Mission Plane** (`mission-control`).
- **Execution Plan** is the immutable, routing-authorized target set (ADR-0004).
- **Simulation** is offline replay through the isolated execution environment
  (IOS-016 Traffic Replay) before deploy — production health/metrics never
  contaminated.

### 4.2 Agent lifecycle

```
Create Agent → Role → Capabilities → Policies → Knowledge Sources → Ontology Access → Permissions → Deployment
```

- Runs via `aiops/agents/agent-runner`; **Capabilities** are grounded in the Model
  Capability Registry (IOS-018); **Ontology Access** + **Permissions** compose with
  the Security boundary (IOS-006) and ontology authority (ONT-001).

### 4.3 Replay → Quality lifecycle

```
Mission → Replay → Metrics → Quality → Policy Compliance → Success Rate → Regression Detection
```

- **Replay** (IOS-016) + **Evaluation** (IOS-017) + the eval harness
  (`aiops/evals/*`) produce quality/compliance/success metrics; **Regression
  Detection** is fed by the learning signal services (`aiops/learning/*`).

### 4.4 Command → Audit lifecycle (governed-first)

```
Command → Policy Evaluation → Approval → Execution → Events → Audit
```

- Every command is **approval-gated** (`mission-control/approvals`); execution emits
  immutable events on the Execution Event Bus (IOS-005); audit is a first-class,
  non-bypassable output. Security middleware may inspect/reject/redact but never
  reroute (AS-001 R6).

### 4.5 Recommendation → Decision lifecycle

```
Recommendation → Evidence → Graph → Policies → Reasoning → Decision → Execution → Observed Outcome
```

- Recommendations are **advisory** canonical objects (frozen taxonomy v1.0; cost →
  IOS-019, sla → IOS-020), each carrying **evidence references** into the ontology
  graph. They never authorize execution; a human/mission **Decision** does, and the
  **Observed Outcome** feeds learning (`recommendation-outcome-service`), closing the
  loop.

### 4.6 The enterprise loop (the whole point)

```
Enterprise State → Mission → Simulation → Decision → Approval → Execution
                 → Observation → Learning → Continuous Improvement ↺
```

Every other lifecycle is a sub-arc of this one. The platform's value is that the loop
is **closed and governed end to end**, not that any single step is clever.

---

## 5. Observability — the Metrics Taxonomy

Continuous improvement requires measuring the loop. The platform's observation surface
(IOS-005 event bus + observability stack, `cost-meter`, eval metrics) is organized
around outcome, cost, and risk signals:

| Category | Signals |
|----------|---------|
| **Outcome** | Mission Success, Success Rate, Failure Causes, Human Overrides |
| **Performance** | Execution Latency, Tool Calls, Retry Count, Approval Latency |
| **Cost** | Reasoning Cost, Token Cost |
| **Risk / Quality** | Policy Violations, Model Drift, Hallucination Rate |

These are the inputs to the Decision and Learning planes — they are *why* the
observational subsystems (health, benchmark, evaluation, cost, sla) exist, and what a
future Runtime-Intelligence plane (roadmap Plane D) consumes.

---

## 6. The Palantir Analogy (orientation only)

A useful external reference, mapped to LAWRENCE planes — analogy, not equivalence:

```
Apollo → Foundry → AIP → Applications
```

| Reference layer | Concern | LAWRENCE planes |
|-----------------|---------|-----------------|
| **Apollo** | Runtime, deployment, operations | Runtime + Platform planes; `mission-control/deployments` |
| **Foundry** | Data integration, ontology, lineage | Ontology + Knowledge planes; `dataops/*` |
| **AIP** | AI operations, agents, governed reasoning | Reasoning + Decision + Mission planes; `aiops/*` + `mission-control` |
| **Applications** | Operator-facing surfaces | Experience plane; domain packs + `src/app` |

---

## 7. Vision vs Reality — Where We Are

Reconciled against ASSESS-003. The lower the plane, the more mature.

| Plane / capability | Maturity | Note |
|--------------------|----------|------|
| Platform (IOS) | ●●●● Complete | IOS-001…020 implemented, consistent, green |
| Mission | ●●●○ Solid | mission-control end-to-end across domain packs |
| Experience | ●●●○ Solid | demo surfaces; production UX is product work |
| Reasoning | ●●●○ Core present | router + agents + functions; reasoning-engine abstraction thin |
| Decision | ●●○○ Partial | advisory recommendations + approval gating; richer decisioning aspirational |
| Knowledge | ●●○○ Partial | deterministic evidence baseline; production retrieval aspirational |
| Ontology | ●●○○ Governed-partial | warn-only validation, zero baseline; enforcement gated |
| Runtime | ●○○○ Spec-only | AS-003/RUN fully specified, zero code, gated on ADR-0005 |

**The two largest deltas between vision and reality:**
1. **Runtime Plane** — the governed Processor Runtime is fully designed but unbuilt
   (the single biggest pending body of work; correctly gated on ADR-0005).
2. **Ontology enforcement + Knowledge depth** — the ontology runs in warn-only mode
   and the knowledge plane uses a deterministic baseline; both are the natural next
   investments to make the object/graph-first thesis fully real.

---

## 8. How this guides sequencing

This vision does not change the governed sequence; it explains *why* it is ordered as
it is:

- **Continue IOS Phase 3** (begin IOS-021) — deepens the Reasoning/Decision planes
  with intelligence and optimization, additively.
- **Approve ADR-0005** when ready — unblocks the Runtime plane, the largest structural
  gap.
- **Mature Ontology + Knowledge** — author AS-004 and an enforcement ADR (the
  zero-baseline precondition is already met), and invest in retrieval, to make
  object/graph-first fully load-bearing.
- **Close governance debt (ASSESS-003 G1–G4)** alongside the above.

Each step is additive, governed, and observable — the platform improves the same way
it asks the enterprise to: through a closed, measured loop.
