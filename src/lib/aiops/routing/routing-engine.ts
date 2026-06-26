// Governed Routing Engine (Milestone 3.0, deliverables #4 + #5).
//
// Consumes a RoutingRequest, a RoutingPolicy, and the ProviderRegistry, and
// produces an immutable RoutingDecision. Evaluation is deterministic:
//   1. Resolve the effective policy (apply the request's tenant override).
//   2. Capability-filter the registry (capability-resolver) — no provider names.
//   3. Apply policy (allow/deny providers, required capabilities + families,
//      maximum context window).
//   4. Order survivors by a total, stable preference key and pick the top.
// No health, latency, or cost scoring.

import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { capabilitySetOf } from "@/lib/aiops/providers/provider-registry-types";
import {
  resolveByCapability,
  type RoutingCandidate,
} from "./capability-resolver";
import {
  deepFreeze,
  effectivePolicy,
  type RoutingDecision,
  type RoutingPolicy,
  type RoutingRejection,
  type RoutingRequest,
} from "./routing-types";

const NONE = Number.MAX_SAFE_INTEGER;

/** Deterministic, total preference key (ascending = better). */
function preferenceKey(
  c: RoutingCandidate,
  req: RoutingRequest,
  pol: RoutingPolicy,
  priorityOf: (provider: string) => number,
): [number, number, number, number, string, string] {
  const prefModel = req.preferredModel && c.descriptor.model === req.preferredModel ? 0 : 1;
  const prefProvider = req.preferredProvider && c.provider === req.preferredProvider ? 0 : 1;
  const list = pol.preferredProviders ?? [];
  const idx = list.indexOf(c.provider);
  const prefList = idx === -1 ? NONE : idx;
  return [prefModel, prefProvider, prefList, priorityOf(c.provider), c.provider, c.descriptor.model];
}

function compareKeys(
  a: [number, number, number, number, string, string],
  b: [number, number, number, number, string, string],
): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return 0;
}

export function route(
  request: RoutingRequest,
  policy: RoutingPolicy,
  registry: ProviderRegistry,
): RoutingDecision {
  const pol = effectivePolicy(policy, request.tenantId);
  const evaluatedProviders = registry.list().map((p) => p.metadata.id);
  const priorityOf = (id: string) => registry.get(id)?.defaultPriority ?? NONE;

  const { eligible, rejected } = resolveByCapability(request, registry);
  const rejections: RoutingRejection[] = [...rejected];

  // Apply declarative policy to the capability-eligible candidates.
  const surviving: RoutingCandidate[] = [];
  for (const c of eligible) {
    const d = c.descriptor;
    if (pol.allowedProviders && !pol.allowedProviders.includes(c.provider)) {
      rejections.push({ provider: c.provider, model: d.model, reason: "provider not in policy allowedProviders" });
      continue;
    }
    if (pol.deniedProviders && pol.deniedProviders.includes(c.provider)) {
      rejections.push({ provider: c.provider, model: d.model, reason: "provider in policy deniedProviders" });
      continue;
    }
    const caps = capabilitySetOf(d);
    const missingPolicyCap = (pol.requiredCapabilities ?? []).find((x) => !caps[x]);
    if (missingPolicyCap) {
      rejections.push({ provider: c.provider, model: d.model, reason: `policy requires capability: ${missingPolicyCap}` });
      continue;
    }
    if (pol.requiredModelFamilies && !pol.requiredModelFamilies.includes(d.family)) {
      rejections.push({ provider: c.provider, model: d.model, reason: `family '${d.family}' not in policy requiredModelFamilies` });
      continue;
    }
    if (pol.maximumContextWindow != null && d.contextWindow > pol.maximumContextWindow) {
      rejections.push({
        provider: c.provider,
        model: d.model,
        reason: `context window ${d.contextWindow} exceeds policy maximum ${pol.maximumContextWindow}`,
      });
      continue;
    }
    surviving.push(c);
  }

  const ordered = [...surviving].sort((a, b) =>
    compareKeys(preferenceKey(a, request, pol, priorityOf), preferenceKey(b, request, pol, priorityOf)),
  );
  const top = ordered[0];

  const decision: RoutingDecision = {
    selectedProvider: top ? top.provider : null,
    selectedModel: top ? top.descriptor.model : null,
    evaluatedProviders,
    rejectionReasons: rejections,
    // Snapshot a deep copy of the effective policy so the record is stable and
    // immutable regardless of later mutation of the caller's policy object.
    policySnapshot: JSON.parse(JSON.stringify(pol)) as RoutingPolicy,
  };
  return deepFreeze(decision);
}
