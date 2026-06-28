/**
 * RFC-PC0 Contract 5 — Domain Pack Contract.
 *
 * A Domain Pack (e.g. Recruiting, Phase 7) is the ONLY place domain meaning lives.
 * It contributes ObjectTypes, Projections, and Capabilities, and declares the Host
 * Services it needs — but it ships NO platform primitives and never bypasses the
 * Kernel. Installing a pack is additive and governed; it cannot weaken the platform.
 */
import type { DomainPackId } from "./common.js";
import type { ObjectTypeDefinition } from "./enterprise-object.js";
import type { ProjectionDescriptor } from "./projection.js";
import type { CapabilityDescriptor } from "./capability.js";
import type { HostServiceName } from "./host-service.js";

/** Everything a pack declares about itself before it can be installed. */
export interface DomainPackManifest {
  readonly id: DomainPackId;
  readonly name: string;
  readonly version: string;
  /** Object types this pack registers into the Enterprise Object Registry. */
  readonly objectTypes: readonly ObjectTypeDefinition[];
  /** Projections this pack registers into the Projection Runtime. */
  readonly projections: readonly ProjectionDescriptor[];
  /** Capabilities this pack provides to other packs/studios. */
  readonly capabilities: readonly CapabilityDescriptor[];
  /** Host services this pack requires (least-privilege; only these are injected). */
  readonly requires: readonly HostServiceName[];
}

/** The installable unit. install() is wiring-only — it registers, it does not execute. */
export interface DomainPackContract {
  readonly manifest: DomainPackManifest;
  /**
   * Register the pack's contributions against the provided registries. Pure wiring:
   * no mutations, no side effects beyond registration. The platform stays governed.
   */
  register(registrar: DomainPackRegistrar): void;
}

/** The narrow registration surface a pack is given — registries, nothing else. */
export interface DomainPackRegistrar {
  addObjectType(def: ObjectTypeDefinition): void;
  addProjection(def: ProjectionDescriptor): void;
  addCapability(def: CapabilityDescriptor): void;
}
