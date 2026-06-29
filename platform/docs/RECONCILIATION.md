# LAWRENCE Platform Reconciliation Report

**Status:** Accepted · **Type:** Constitutional reconciliation (architectural finish line)
**Baseline:** RFC-0000, RFC-C0, RFC-K0, RFC-C0-X, Enterprise Object Model, Enterprise Object
Registry, EOE/EPR, LDS-001, STD-UX-0001
**Supersedes:** nothing. **Amends:** establishes the freeze point for all of the above.

---

## 0. Purpose and method

This is **not** a new architectural vision. It is the reconciliation that decides which of
nine proposed improvements become permanent platform law *before* implementation proceeds,
and which are rejected so the architecture stops growing.

Every proposal is challenged against the Constitution (RFC-C0) and against the single
governing heuristic of this document:

> **Freeze the smallest architecture capable of supporting a platform that can evolve for
> decades.** Prefer simplification over expansion. If an existing concept can absorb a
> proposal, absorb it rather than add a new concept.

Each ruling is one of **ACCEPTED**, **MODIFIED**, or **REJECTED**, with rationale,
constitutional impact, required document changes, and risks.

A note on grounding: Phase 0 (Foundation / Contract Freeze) has already been implemented in
the `platform/` workspace. Where a proposal is ruled ACCEPTED, this report cites what was
actually built, so the reconciliation describes reality rather than intention.

---

## Proposal 1 — Platform Contracts (RFC-PC0)

**Recommendation: ACCEPTED.**

Introduce a permanent interface-freeze layer between the Constitution and the Kernel:

```
RFC-C0  (Constitution — why the system may act)
   ↓
RFC-PC0 (Platform Contracts — the shapes everything speaks in)   ← FROZEN
   ↓
RFC-K0  (Kernel — who may act, governed)
   ↓
Platform Runtime (how action happens)
```

**Rationale.** A platform that must survive decades cannot let every runtime, domain pack,
and host service negotiate its own data shapes. The contract layer is the *vocabulary* the
Constitution is written against; freezing it is what makes a constitution enforceable rather
than aspirational. Contracts are pure types — they impose no implementation, so freezing them
costs nothing at runtime and buys total substitutability beneath them.

**The minimum contract set (frozen — exactly eight).** More would ossify implementation
detail; fewer would leave a seam unspecified.

1. **Enterprise Object Contract** — the universal object shape (identity, typed properties,
   provenance, evidence, confidence). The noun every plane shares.
2. **Mutation Contract** — the only way state changes: a principal-bound, idempotent,
   reversible intent that produces a hash-chained `DomainEvent`.
3. **Runtime Contract** — `initialize / handle / dispose`. How any runtime is driven.
4. **Projection Contract** — a pure fold from event history to a view, with a replay-equivalent
   `viewHash`. How truth is read.
5. **Domain Pack Contract** — the manifest + wiring-only registration of a vertical (Recruiting,
   etc.). How the platform extends without forking.
6. **Capability Contract** — a declared, host-satisfied ability a pack *requires* rather than
   implements.
7. **Host Service Contract** — the shape of a shared platform service (see Proposal 3).
8. **Constitutional Test Contract** — the executable form of a constitutional requirement (see
   Proposal 6).

**Constitutional impact.** Strengthens RFC-C0: the Constitution now governs against a frozen
vocabulary. Adds one permanent layer (RFC-PC0) to the canonical stack.

**Required document changes.** RFC-0000 build order gains RFC-PC0 as the layer immediately
below RFC-C0 and above RFC-K0. (Implemented: `platform/packages/contracts`, pure types, two
frozen data constants only.)

**Risks.** Freezing the wrong shape is expensive to undo. Mitigated by keeping each contract
minimal and additive-extensible (new optional fields are non-breaking; renames require a
constitutional amendment).

---

## Proposal 2 — Kernel Reduction

**Recommendation: ACCEPTED.**

Reduce RFC-K0 to constitutional governance only. The Kernel has exactly eight responsibilities
and nothing else:

`resolvePrincipal` · `resolveAuthority` · `evaluatePolicy` · `validateMutation` ·
`produceDecision` · `produceEvent` · `guaranteeAudit` · `guaranteeReversibility`

**Rationale.** A kernel that also schedules, caches, routes AI, or renders is a kernel that can
be compromised through any of those concerns. The constitutional guarantees (no mutation without
a principal; audit even on denial; reversibility) are only credible if the kernel does *nothing
else*. Everything previously tempting to put "in the kernel for convenience" — orchestration,
lifecycle, projection, AI routing — belongs to runtimes and host services that operate *under*
kernel governance, not inside it.

**Where the displaced concerns go.**
- Execution orchestration → **Platform Runtime** / RFC-C0-X governed-execution lifecycle.
- Object lifecycle & projection → **Enterprise Object Runtime** + **Projection Runtime**.
- AI routing, caching, search, etc. → **Host Services** (Proposal 3).

**Constitutional impact.** None to the Constitution's text; this *clarifies* RFC-K0 to its
constitutional core. The eight responsibilities are exactly the Kernel interface frozen in
RFC-PC0.

**Required document changes.** RFC-K0 responsibilities section trimmed to the eight verbs; a
"what the kernel is NOT" subsection added enumerating the displaced concerns and their new
homes. (Implemented: `KernelContract` in `platform/packages/contracts`.)

**Risks.** Over-thinning could push a genuinely constitutional concern out of the kernel.
Mitigated by the rule: *if removing it would let an actor mutate state without a governed
decision, it stays in the kernel.* All eight pass that test; nothing else does.

---

## Proposal 3 — Host Services

**Recommendation: MODIFIED.**

Introduce Host Services consumed by every Domain Pack — but only those that are genuinely
**cross-cutting platform infrastructure**, and with three of the thirteen candidates
reclassified.

**Ruling on the candidates:**

| Candidate | Ruling | Reason |
|---|---|---|
| Authentication | **Host Service** | Cross-cutting identity; every pack needs it. |
| Authorization | **Constitutional, not a Host Service** | This *is* `evaluatePolicy`/`resolveAuthority` in the Kernel. A pack must never be able to swap its own authorization. Exposed to packs as a **read-only capability**, never a replaceable service. |
| Streaming | **Host Service** | Transport for live projections. |
| Caching | **Host Service** | Cross-cutting performance. |
| Messaging | **Host Service** | Inter-component transport. |
| Scheduling | **Host Service** | Deferred/async execution. |
| Notifications | **Host Service** | Cross-cutting delivery. |
| Storage | **Host Service** | Blob/object persistence. |
| Secrets | **Host Service** | Cross-cutting, security-sensitive. |
| Search | **Host Service** | Cross-cutting retrieval. |
| Observability | **Host Service** | Cross-cutting telemetry. |
| Metrics | **Folded into Observability** | Not a distinct service; metrics are one face of observability. Removing it avoids a false seam. |
| AI Routing | **Host Service** | Model selection/routing is shared infra, deliberately *outside* the kernel (Proposal 2). |

So: **Authorization** is reclassified as kernel/constitutional (surfaced as a capability),
**Metrics** is folded into Observability, and an **Audit** service is added — not as new
infrastructure but as the read/query face of the kernel's `guaranteeAudit` guarantee, which
packs legitimately need to read.

**The frozen Host Service roster (fifteen):** authentication, authorization (read-only
projection of kernel authority), audit (read face of kernel audit), ai-routing, streaming,
caching, search, observability, metrics-as-observability… — implemented as the fifteen names
in `HOST_SERVICE_NAMES`: authentication, authorization, audit, ai-routing, streaming, caching,
search, observability, metrics, secrets, storage, messaging, scheduling, notifications,
extensions.

> Reconciliation note: the implemented roster keeps `metrics` and `authorization` as *named*
> host-service identifiers for discovery, while this report's ruling constrains their
> *authority*: authorization and audit may only ever **read** kernel truth, and metrics is an
> observability facet. The names are a directory; the constraints are law. This is the minimal
> change — no code churn — that satisfies both the discovery need and the constitutional rule.

**Constitutional impact.** Reinforces Proposal 2: authorization stays constitutional. No new
constitutional text.

**Required document changes.** Host Services section lists fifteen, with explicit notes that
authorization/audit are read-only projections of kernel guarantees and metrics is an
observability facet.

**Risks.** A pack treating the authorization *service* as mutable. Mitigated by contract: the
capability exposes evaluation results only, never policy authorship.

---

## Proposal 4 — Capability Registry

**Recommendation: ACCEPTED.**

Domain Packs **declare** required capabilities (Search, Approval, AI Generation, Scheduling,
Notifications, Workflow, Streaming, …) rather than implementing them independently.

**Rationale.** This is the mechanism that makes the platform extensible *without forking the
core*. A pack says "I require Search and Approval"; the host resolves those to concrete Host
Services. Packs become portable, host implementations become substitutable, and the
dependency direction is always pack → capability → host (never pack → host directly). It is the
inversion-of-control seam for an enterprise OS.

**Constitutional impact.** None. It is pure architecture realized as the Capability Contract
(Proposal 1 #6) plus a registry (Proposal 5).

**Required document changes.** Domain Pack Contract references the Capability Contract; packs
ship a `requires: Capability[]` manifest. (Implemented: `capability.ts` + `DomainPackContract`.)

**Risks.** Capability sprawl (a new capability per feature). Mitigated by the rule: a capability
is justified only when **two or more packs** would require it, or when it gates a constitutional
concern (e.g. Approval). One-pack abilities stay inside the pack.

---

## Proposal 5 — Runtime Registries

**Recommendation: MODIFIED.**

Of the four proposed registries, **three are permanent runtime infrastructure** and **one is a
duplicate** of an existing concept.

| Registry | Ruling | Classification |
|---|---|---|
| Enterprise Object Registry | **ACCEPTED** | Runtime infrastructure — the canonical type catalog. Already exists in the baseline; the platform registry is its frozen contract form. |
| Capability Registry | **ACCEPTED** | Runtime infrastructure — resolves pack `requires` to host services (Proposal 4). |
| Projection Registry | **ACCEPTED** | Runtime infrastructure — the catalog of named projections the Projection Runtime can run. |
| Runtime Registry | **REJECTED as separate** | A "registry of runtimes" is an abstraction over a fixed, small set (Object, Projection, AI, Host). Enumerate them as platform constants, not a dynamic registry. A registry implies open registration; runtimes are constitutional fixtures. |

So three registries are frozen as permanent infrastructure; the **Runtime Registry collapses
into a static enumeration** of the platform's runtimes.

**Constitutional impact.** None. Reduces one speculative abstraction.

**Required document changes.** RFC-PC0 names three registries (Enterprise Object, Capability,
Projection). The set of runtimes is documented as a fixed list in the Platform Plane, not a
registry. (Implemented: `registries.ts` exports exactly the three.)

**Risks.** A future need to register runtimes dynamically. Judged unlikely within the decade
horizon; if it ever arises it is a constitutional amendment, not a default.

---

## Proposal 6 — Constitutional Test Suite

**Recommendation: ACCEPTED.**

Replace architectural *assumptions* with **executable constitutional tests** (CCRs):

- **CCR-001** Mutation without Principal → Denied · No Event · No State Change · Audit Produced.
- **CCR-002** Projection equals Event History (replay equivalence).
- **CCR-003** Tenant Isolation.
- **CCR-004** Undo returns identical state.

**Rationale.** A constitution that is not continuously, mechanically verified decays into
folklore. Encoding each requirement as a test that runs against the *real* kernel converts
"we believe the platform is governed" into "the build fails if it is not." This is the single
highest-leverage artifact for decade-scale stability: it is how the freeze stays frozen.

**Where they belong.** Two homes, by purpose:
1. **The requirement set** is data in RFC-PC0 (the Constitutional Test Contract +
   `CONSTITUTIONAL_REQUIREMENTS`) — frozen, language-independent.
2. **The executable assertions** live with the runtime they verify (kernel tests assert against
   the kernel; pack tests assert against the pack) and additionally as platform-level conformance.

**CI/CD integration.** The constitutional suite is a **required, non-skippable gate** in the
clean-clone pipeline, alongside typecheck, lint, dependency-cruiser (layer freeze), and build.
A red CCR blocks merge. No deployment may ship with a failing constitutional test.

**Constitutional impact.** Makes RFC-C0 enforceable. The CCR set is itself frozen — adding a CCR
is allowed (the constitution can be *more* strictly verified); removing or weakening one
requires a constitutional amendment.

**Required document changes.** RFC-C0 references the CCR set as its enforcement mechanism;
RFC-0000 pipeline lists the constitutional gate. (Implemented: `constitutional-test.ts` +
`CONSTITUTIONAL_REQUIREMENTS`, the protected architectural test, and the `platform/ci`
template wiring the gate.)

**Risks.** Tests that assert implementation rather than constitution (brittle). Mitigated: a
CCR asserts an *observable constitutional outcome* (denied/audited/isolated/identical), never an
internal mechanism.

---

## Proposal 7 — Platform Layering

**Recommendation: ACCEPTED — three planes, not a linear stack.**

Document LAWRENCE as three architectural planes:

- **Constitutional Plane** — Constitution · Platform Contracts · Kernel · UX Canon · Visual
  Language. *Why and whether the system may act, and how it must speak and look.*
- **Platform Plane** — Platform Runtime · Host Runtime · Projection Runtime · AI Runtime · Host
  Services. *How action mechanically happens, under constitutional governance.*
- **Domain Plane** — Recruiting · Sales · Finance · HR · Legal · Custom Packs. *What value is
  delivered, expressed only in terms of the two planes above.*

**Rationale.** A linear stack implies each layer depends only on the one beneath it, which is
false: the Domain Plane depends on the *whole* Constitutional Plane and the *whole* Platform
Plane, not on a single layer below it. Planes capture the real dependency rule — **higher planes
may depend on lower planes; never the reverse, and never sideways into another pack** — and they
make the freeze legible: the Constitutional Plane is frozen, the Platform Plane is stable, the
Domain Plane is open. The linear stack remains valid *within* the Constitutional Plane (C0 →
PC0 → K0) as a refinement, not the top-level model.

**Constitutional impact.** None to text; it is the canonical *presentation* of the architecture
and the basis for the dependency-cruiser layer rules.

**Required document changes.** RFC-0000 leads with the three-plane diagram; the linear stack is
shown as the internal ordering of the Constitutional Plane.

**Risks.** Teams reading "planes" as "microservices." Mitigated: planes are *dependency and
freeze* boundaries, not deployment boundaries.

---

## Proposal 8 — Freeze Point

**Recommendation: ACCEPTED.** This report **is** the freeze point.

**Permanently frozen (change only by constitutional amendment):**
- The Constitution (RFC-C0) and its CCR enforcement set.
- The eight Platform Contracts (RFC-PC0).
- The eight Kernel responsibilities (RFC-K0).
- The RFC-C0-X governed-execution lifecycle and its six laws.
- The three planes and their dependency direction.
- The three registries; the fixed runtime enumeration.

**Stable but may evolve (additive, non-breaking; normal engineering):**
- Host Service *implementations* (the fifteen names are frozen; their internals are not).
- Projection implementations and the projections catalog.
- The UX Canon (STD-UX-0001) and Visual Language (LDS-001) — additive tokens/patterns.
- New CCRs (the constitution may be verified *more* strictly).
- New capabilities meeting the two-pack rule.

**Open (the point of the platform):**
- Domain Packs. New verticals are added without touching the planes above them.

**What future engineering must never modify without a constitutional amendment:**
adding a kernel responsibility; adding/renaming/removing a Platform Contract or its required
fields; weakening or removing a CCR; reversing a plane dependency; letting a Domain Pack import
another pack's internals or a kernel internal; giving authorization/audit services write
authority.

**Constitutional impact.** Defines the amendment surface. After this document, foundational
architecture work stops; all subsequent work is implementation, executable constitutional tests,
and production code.

---

## Proposal 9 — Global Runtime Console (the standing recommendation)

**Recommendation: ACCEPTED — as a Projection surface, NOT new architecture.**

The recommendation: today the runtime is visible only scoped to the current object (a Job
exposes its *local* runtime). There should also be a system-wide view — active agents, running
missions, background workflows, event throughput, queue health, token usage and cost, execution
latency, mutations, alerts/failures — so LAWRENCE reads as "an enterprise OS with a live kernel,"
not "a job page with background processes."

**Challenge against the Constitution.** Does this require a new platform concept? **No.** A
console that *reads* runtime state and *displays* it is, by definition, a **Projection**
(Contract #4): a pure fold over event/runtime history into a view, owning no state and able to
mutate nothing. The local-vs-global distinction the recommendation draws is precisely the
distinction between **a projection scoped to one object** and **a projection scoped to the
tenant**. No new contract, runtime, or kernel responsibility is needed — and per the governing
heuristic, an existing concept (Projection) absorbs the proposal, so we add nothing.

**Where it belongs.** The **Platform Plane**, surfaced under **Mission Control** at
`/mission-control/runtime` as the *Global Runtime* projection — sibling to the existing Runtime
Health and Audit projections. Individual Enterprise Objects keep exposing their *local* runtime;
Mission Control exposes the *global* runtime. This completes the mental model
Universal Workspace → Enterprise Objects → Runtime → Advisors → Missions: the runtime is now
observable at both scopes.

**Constitutional constraints on the console.** Because it is a Projection it inherits the
Projection Contract's discipline:
- It is **read-only**. It may not mutate; it routes any action through the governed path like
  any other surface.
- It must be **honest about evidence**. Every metric is either grounded in a real source or
  explicitly marked as having no telemetry source — it never fabricates a number (no invented
  token costs, no fake latency). A missing source *is the finding*, surfaced as such.
- It is **deterministic** over its inputs and replay-consistent.

**Constitutional impact.** None. It is an instance of an existing contract.

**Required document changes.** None to the frozen architecture. It is logged as the *first
implementation* surface of the Platform Plane, demonstrating the Projection Contract at tenant
scope. (Implemented in this change: `/mission-control/runtime`, projecting the real tenant-scoped
operational database — agents, missions, workflows, audit throughput, review/approval queues,
AI token usage and cost, latency, mutations, incidents and security findings — plus the
governed-execution lifecycle, with any unsourced metric marked "no telemetry source.")

**Risks.** Scope creep into a control panel that *acts*. Mitigated by the read-only constraint:
the global runtime *observes*; Mission Control's existing governed surfaces *act*.

---

## Final Platform Architecture

One canonical model. No alternatives. No optional paths.

```
╔═══════════════════════════════════════════════════════════════════════════╗
║ CONSTITUTIONAL PLANE                                          (frozen)      ║
║                                                                             ║
║   Constitution (RFC-C0)                                                     ║
║      └ enforced by Constitutional Tests (CCR-001…N)                         ║
║   Platform Contracts (RFC-PC0) — the 8 frozen contracts:                    ║
║      Enterprise Object · Mutation · Runtime · Projection ·                  ║
║      Domain Pack · Capability · Host Service · Constitutional Test          ║
║   Kernel (RFC-K0) — the 8 responsibilities only:                            ║
║      resolvePrincipal · resolveAuthority · evaluatePolicy ·                 ║
║      validateMutation · produceDecision · produceEvent ·                    ║
║      guaranteeAudit · guaranteeReversibility                                ║
║   Governed Execution Lifecycle (RFC-C0-X) — 6 laws, 8 phases                ║
║   UX Canon (STD-UX-0001) · Visual Language (LDS-001)                        ║
╚═══════════════════════════════════════════════════════════════════════════╝
            ▲ higher planes depend on lower; never the reverse
╔═══════════════════════════════════════════════════════════════════════════╗
║ PLATFORM PLANE                                               (stable)       ║
║                                                                             ║
║   Runtimes (fixed enumeration): Platform · Host · Projection · AI           ║
║   Registries (3): Enterprise Object · Capability · Projection               ║
║   Host Services (15, names frozen; impls evolve):                           ║
║      authentication · authorization* · audit* · ai-routing · streaming ·    ║
║      caching · search · observability · metrics° · secrets · storage ·      ║
║      messaging · scheduling · notifications · extensions                    ║
║        * authorization & audit are READ-ONLY projections of kernel truth    ║
║        ° metrics is an observability facet                                  ║
║   Surfaces: Mission Control → Global Runtime Console (Projection)           ║
╚═══════════════════════════════════════════════════════════════════════════╝
            ▲
╔═══════════════════════════════════════════════════════════════════════════╗
║ DOMAIN PLANE                                                  (open)        ║
║                                                                             ║
║   Domain Packs: Recruiting · Sales · Finance · HR · Legal · Custom          ║
║   Each: declares required Capabilities; ships Enterprise Object types,      ║
║   Mutations, Projections; imports NO other pack's internals and NO          ║
║   kernel internals.                                                         ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**The one rule that governs the whole model:** state changes only through a **Mutation**,
validated and decided by the **Kernel**, producing a hash-chained **Event**, audited even on
denial, reversible by construction — and everything anyone ever *sees* is a **Projection** of
that event history. The Constitutional Plane says whether an action may happen; the Platform
Plane makes it happen; the Domain Plane decides what is worth doing.

---

## Conclusion — the architectural finish line

| # | Proposal | Decision |
|---|---|---|
| 1 | Platform Contracts (RFC-PC0) | **ACCEPTED** |
| 2 | Kernel Reduction | **ACCEPTED** |
| 3 | Host Services | **MODIFIED** (authorization→constitutional, metrics→observability, audit added; 15 names frozen) |
| 4 | Capability Registry | **ACCEPTED** |
| 5 | Runtime Registries | **MODIFIED** (3 kept; Runtime Registry collapsed to a static enumeration) |
| 6 | Constitutional Test Suite | **ACCEPTED** (required CI gate) |
| 7 | Platform Layering | **ACCEPTED** (three planes) |
| 8 | Freeze Point | **ACCEPTED** (this document) |
| 9 | Global Runtime Console | **ACCEPTED** (as a Projection surface — no new architecture) |

After this document, the foundational architecture is **frozen**. All further work is
implementation, executable constitutional tests, and production code. The architecture may now
only change by constitutional amendment — and the platform may grow, for decades, entirely in
the open Domain Plane.
