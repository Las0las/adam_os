/**
 * RFC-PC0 Contract 7 — Host Service Contract.
 *
 * Host Services are the platform-provided capabilities Domain Packs and Runtimes
 * consume instead of reaching for infrastructure directly. They are declared here
 * as frozen interfaces; concrete adapters (Phase 8 Host Runtime) implement them.
 * Pulling these OUT of the Kernel is what keeps the Kernel small.
 */
import type { CapabilityId, Result, TenantContext } from "./common.js";

/** The fifteen permanent host services. The set is frozen; adapters vary. */
export type HostServiceName =
  | "authentication"
  | "authorization"
  | "audit"
  | "ai-routing"
  | "streaming"
  | "caching"
  | "search"
  | "observability"
  | "metrics"
  | "secrets"
  | "storage"
  | "messaging"
  | "scheduling"
  | "notifications"
  | "extensions";

/** Common shape every host service exposes for discovery + health. */
export interface HostService {
  readonly name: HostServiceName;
  readonly capability: CapabilityId;
  readonly version: string;
  /** Liveness/readiness probe used by the Host Runtime and observability. */
  health(ctx: TenantContext): Promise<Result<HostServiceHealth>>;
}

export interface HostServiceHealth {
  readonly status: "ok" | "degraded" | "down";
  readonly detail?: string;
}

/**
 * The Host Services container handed to Domain Packs. Resolution is by name and is
 * tenant-agnostic at wiring time; calls are tenant-scoped. A pack receives ONLY the
 * services it declared in its manifest (least privilege).
 */
export interface HostServices {
  get(name: HostServiceName): Result<HostService>;
  has(name: HostServiceName): boolean;
}
