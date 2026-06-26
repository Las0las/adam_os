// Governed Routing Engine — canonical types (Milestone 3.0).
//
// Applications submit a provider-independent RoutingRequest. The engine
// evaluates the Provider Registry against the request and a declarative
// RoutingPolicy and returns an immutable RoutingDecision. Evaluation is
// deterministic and uses ONLY published model capabilities + policy — never a
// provider's name (allow/deny lists are explicit policy, not name heuristics).
//
// No health, latency, or cost scoring (later milestones).

import type { CapabilitySet } from "@/lib/aiops/providers/provider-registry-types";

export type Capability = keyof CapabilitySet;

/** Provider-independent description of what a workload needs. */
export interface RoutingRequest {
  workloadType: string;
  requiredCapabilities?: Capability[];
  preferredModel?: string;
  preferredProvider?: string;
  streamingRequired?: boolean;
  toolCallingRequired?: boolean;
  structuredOutputRequired?: boolean;
  minimumContextWindow?: number;
  /** Optional tenant id, used to apply RoutingPolicy.tenantOverrides. */
  tenantId?: string;
}

/** Declarative routing policy. All fields optional; an empty policy permits
 *  every capability-eligible model. */
export interface RoutingPolicy {
  allowedProviders?: string[];
  deniedProviders?: string[];
  preferredProviders?: string[];
  requiredCapabilities?: Capability[];
  requiredModelFamilies?: string[];
  /** Eligible models must not exceed this context window. */
  maximumContextWindow?: number;
  /** Per-tenant policy overrides (shallow-merged over the base policy). */
  tenantOverrides?: Record<string, Partial<RoutingPolicy>>;
}

/** A (provider, model) pair that was rejected, with a deterministic reason. */
export interface RoutingRejection {
  provider: string;
  model: string;
  reason: string;
}

/** Immutable result of a routing evaluation — the foundation for explainability. */
export interface RoutingDecision {
  selectedProvider: string | null;
  selectedModel: string | null;
  evaluatedProviders: string[];
  rejectionReasons: RoutingRejection[];
  policySnapshot: RoutingPolicy;
}

/** Map the request's boolean flags onto the capabilities they imply. */
export function impliedCapabilities(req: RoutingRequest): Capability[] {
  const caps: Capability[] = [...(req.requiredCapabilities ?? [])];
  if (req.streamingRequired) caps.push("streaming");
  if (req.toolCallingRequired) caps.push("tools");
  if (req.structuredOutputRequired) caps.push("json");
  return [...new Set(caps)];
}

/** Resolve the effective policy for a request: the base policy with the
 *  request's tenant override shallow-merged over it (deterministic). */
export function effectivePolicy(policy: RoutingPolicy, tenantId?: string): RoutingPolicy {
  const override = tenantId ? policy.tenantOverrides?.[tenantId] : undefined;
  return override ? { ...policy, ...override } : { ...policy };
}

/** Deep-freeze an object graph (objects + arrays). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
