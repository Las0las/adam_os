/**
 * RFC-PC0 Contract 3 — Runtime Contract.
 *
 * The uniform interface every runtime satisfies to be registered and driven by the
 * platform: the Enterprise Object Runtime (Phase 2), the Projection Runtime (Phase
 * 4), the AI Runtime (Phase 9), and any future runtime. A runtime is a governed,
 * versioned engine that resolves a typed request to a typed result — it never
 * mutates state except through the Mutation contract.
 */
import type { CapabilityId, Result, RuntimeId, TenantContext } from "./common.js";

/** Self-describing metadata a runtime must publish to be registered. */
export interface RuntimeDescriptor {
  readonly id: RuntimeId;
  readonly kind: "enterprise-object" | "projection" | "ai" | "host" | "custom";
  readonly version: string;
  /** Capabilities this runtime requires from Host Services to operate. */
  readonly requires: readonly CapabilityId[];
  /** Capabilities this runtime provides to consumers. */
  readonly provides: readonly CapabilityId[];
}

/** A request handed to a runtime. Always tenant-scoped; payload is runtime-specific. */
export interface RuntimeRequest<P = unknown> {
  readonly ctx: TenantContext;
  readonly operation: string;
  readonly payload: P;
}

/** The lifecycle + dispatch surface a runtime implements. */
export interface RuntimeContract {
  readonly descriptor: RuntimeDescriptor;
  /** Bind Host Services / dependencies. Called once before any handle(). */
  initialize(host: RuntimeHost): Promise<Result<void>>;
  /** Resolve a request to a serializable result. Pure w.r.t. declared inputs. */
  handle<P, R>(request: RuntimeRequest<P>): Promise<Result<R>>;
  /** Release resources. After dispose(), handle() must not be called. */
  dispose(): Promise<void>;
}

/** The narrow view of the platform a runtime is given at init (capability handles only). */
export interface RuntimeHost {
  resolve<T>(capability: CapabilityId): Result<T>;
}
