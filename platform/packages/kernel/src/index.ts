/**
 * @lawrence/kernel — public surface (Phase 0 placeholder).
 *
 * Phase 0 freezes the CONTRACT, not the implementation. This package exists to
 * prove the layering: it imports the `Kernel` interface from @lawrence/contracts
 * and re-exports a typed factory whose internals (the append-only ledger store)
 * are deliberately NOT exported. Downstream packages depend on this barrel only.
 *
 * The real governed implementation lands in a later phase.
 */
export type { Kernel } from "@lawrence/contracts";

/**
 * The kernel's public capability surface. Phase 0 ships the shape; the bodies
 * are stubs that throw `NOT_IMPLEMENTED` so no accidental ungoverned mutation
 * can occur before the real kernel exists (deny-by-default, even in scaffolding).
 */
export const KERNEL_PUBLIC_API = Object.freeze([
  "resolvePrincipal",
  "resolveAuthority",
  "evaluatePolicy",
  "validateMutation",
  "produceDecision",
  "produceEvent",
  "guaranteeAudit",
  "guaranteeReversibility",
] as const);

export type KernelPublicMethod = (typeof KERNEL_PUBLIC_API)[number];
