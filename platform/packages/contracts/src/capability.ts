/**
 * RFC-PC0 Contract 6 — Capability Contract.
 *
 * A Capability is a named, versioned ability the platform can grant, require, or
 * provide (e.g. "host.storage", "host.ai-routing", "projection.kanban"). Capabilities
 * are how runtimes, domain packs, and host services declare their surface without
 * importing each other's implementations — the decoupling that keeps layers frozen.
 */
import type { CapabilityId } from "./common.js";

export type CapabilityScope = "host" | "runtime" | "projection" | "domain";

export interface CapabilityDescriptor {
  readonly id: CapabilityId;
  readonly scope: CapabilityScope;
  readonly version: string;
  readonly summary: string;
  /** Other capabilities that must be present for this one to function. */
  readonly dependsOn: readonly CapabilityId[];
}

/** A concrete grant of a capability to a consumer, resolved at composition time. */
export interface CapabilityGrant<T = unknown> {
  readonly descriptor: CapabilityDescriptor;
  /** The typed handle the consumer uses. Behavior lives behind this boundary. */
  readonly handle: T;
}
