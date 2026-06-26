// Capability Resolver (Milestone 3.0, deliverable #3).
//
// Given a RoutingRequest, enumerate registered providers + their published
// model descriptors, and filter by CAPABILITY only — declared model flags,
// context window, and deprecation. It performs NO provider-name checks; allow/
// deny by provider is policy (applied by the routing engine), not capability.

import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import {
  capabilitySetOf,
  type ModelDescriptor,
} from "@/lib/aiops/providers/provider-registry-types";
import {
  impliedCapabilities,
  type RoutingRejection,
  type RoutingRequest,
} from "./routing-types";

export interface RoutingCandidate {
  provider: string;
  descriptor: ModelDescriptor;
}

export interface CapabilityResolution {
  eligible: RoutingCandidate[];
  rejected: RoutingRejection[];
}

export function resolveByCapability(
  request: RoutingRequest,
  registry: ProviderRegistry,
): CapabilityResolution {
  const required = impliedCapabilities(request);
  const eligible: RoutingCandidate[] = [];
  const rejected: RoutingRejection[] = [];

  for (const provider of registry.list()) {
    const id = provider.metadata.id;
    for (const descriptor of provider.descriptors) {
      const caps = capabilitySetOf(descriptor);
      const missing = required.find((c) => !caps[c]);
      if (missing) {
        rejected.push({ provider: id, model: descriptor.model, reason: `missing capability: ${missing}` });
        continue;
      }
      if (descriptor.deprecated) {
        rejected.push({ provider: id, model: descriptor.model, reason: "model is deprecated" });
        continue;
      }
      if (
        request.minimumContextWindow != null &&
        descriptor.contextWindow < request.minimumContextWindow
      ) {
        rejected.push({
          provider: id,
          model: descriptor.model,
          reason: `context window ${descriptor.contextWindow} < required ${request.minimumContextWindow}`,
        });
        continue;
      }
      eligible.push({ provider: id, descriptor });
    }
  }

  return { eligible, rejected };
}
