# LAWRENCE Platform

Phase 0 — **Foundation / Contract Freeze**.

This monorepo is platform infrastructure, not a demo app. It exists to make the
platform _durable by freezing contracts, not implementations_. Phase 0 ships the
toolchain and the single frozen interface package, `@lawrence/contracts`, plus the
test harness that protects the architectural layer boundaries.

## Layer model

```
RFC-C0   Constitution
   ↓
RFC-PC0  Platform Contracts      ← @lawrence/contracts (this phase)
   ↓
RFC-K0   Kernel                  ← @lawrence/kernel (placeholder; Phase 1)
   ↓
         Runtime Registry
   ↓
         Domain Packs
   ↓
         Host Runtime
   ↓
         Studios / Workspace     ← @lawrence/workspace (placeholder; Phase 3+)
```

Dependencies only point **down**. The protected rule of Phase 0: **UI / Workspace
packages can never import Kernel internals** — they speak only through frozen
contracts. This is enforced two ways: a `dependency-cruiser` layer rule
(`pnpm lint:arch`) and a self-validating Vitest guard in `@lawrence/workspace`.

## Clean clone

A fresh clone must pass every gate with no extra setup:

```bash
corepack enable          # provides pnpm@10
cd platform
pnpm install
pnpm lint                # eslint + prettier-compatible + architectural layer rules
pnpm typecheck           # strict TypeScript, project-wide
pnpm test                # contract + constitutional (CCR) harness via Vitest
pnpm build               # tsc build of every package
```

`pnpm ci` runs all four gates in order. End-to-end (`pnpm test:e2e`) is a separate,
on-demand command and is intentionally **not** part of the `test` gate (no Studios
exist yet, and a clean clone should not need a browser download to go green).

## Packages

| Package               | Role                                                            |
| --------------------- | --------------------------------------------------------------- |
| `@lawrence/contracts` | The 8 frozen RFC-PC0 contracts + 3 registries + Host Services.  |
| `@lawrence/kernel`    | Phase 1 placeholder. Holds the protected `internal/` boundary.  |
| `@lawrence/workspace` | Phase 3+ placeholder. Hosts the import-boundary guard test.     |

## What Phase 0 deliberately does NOT do

No kernel logic. No recruiting concepts. No AI runtime. No new architecture
documents. Implementation in later phases asks exactly one question: _does this
implement an existing contract?_ If yes, build it. If no, the contract is wrong or
the feature does not belong.
