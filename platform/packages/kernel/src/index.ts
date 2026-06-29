/**
 * @lawrence/kernel — public surface (Phase 1: real governed implementation).
 *
 * Phase 0 froze the CONTRACT; Phase 1 ships the implementation behind it. This
 * barrel is the ONLY entry point downstream packages may import. The append-only
 * event log, audit ledger, principal registry, and hashing live under
 * ./internal/* and are NOT exported — the protected architectural test and
 * dependency-cruiser enforce that no consumer reaches past this surface.
 */
export type { Kernel } from "@lawrence/contracts";

export { LawrenceKernel, createKernel } from "./kernel.js";
export type { KernelOptions } from "./kernel.js";
export type { SeedPrincipal } from "./internal/principal-registry.js";
export type { ObjectState } from "./internal/event-log.js";

/**
 * The kernel's public capability surface — the eight, and only eight,
 * responsibilities of RFC-K0. Shipped as frozen literal data so docs, tests,
 * and the Global Runtime Console share one source of truth.
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
