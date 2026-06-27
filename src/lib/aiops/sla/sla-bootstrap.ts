// IOS-020 — SLA Management — wiring.
//
// Exposes the process-wide SLA Management Engine + its recommendation store (the
// shared RecommendationStore class, holding SLARecommendation objects under the
// canonical taxonomy). Advisory and on-demand: installing it registers NO execution
// hook and changes no execution behavior. Default policy DISABLED (no-op).

import { RecommendationStore } from "@/lib/aiops/recommendation/recommendation-store";
import { SLAManagementEngine } from "./sla-engine";
import { SLAPolicyStore, type SLAPolicy } from "./sla-types";

export interface SLAStack {
  policyStore: SLAPolicyStore;
  store: RecommendationStore;
  engine: SLAManagementEngine;
}

const globalRef = globalThis as unknown as { __lawrenceSLA?: SLAStack };

export function slaPlatform(): SLAStack {
  if (!globalRef.__lawrenceSLA) {
    const policyStore = new SLAPolicyStore();
    const store = new RecommendationStore();
    globalRef.__lawrenceSLA = { policyStore, store, engine: new SLAManagementEngine(store, policyStore) };
  }
  return globalRef.__lawrenceSLA;
}

export function installSLAManagement(policy?: SLAPolicy): SLAStack {
  const stack = slaPlatform();
  if (policy) stack.policyStore.configure(policy);
  return stack;
}

/** The read-only SLA recommendation store (for advisory consumers). */
export function slaRecommendationStore(): RecommendationStore {
  return slaPlatform().store;
}
