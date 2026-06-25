// Phase 4 — ONBOARDING live workflow pack: agent graph.
// The blocker-escalation agent wires the readiness function into a
// condition -> notify(action) -> review -> output flow.

import { now } from "@/lib/lawrence-core/utils/ids";
import type { AgentDefinition } from "@/types/aiops";

/**
 * Onboarding blocker-escalation agent (v2):
 *   input -> function(onboarding.readiness_summary) -> condition(not ready)
 *         -> action(onboarding.notify_owner) -> review -> output.
 */
export function onboardingBlockerAgentV2(tenantId: string): AgentDefinition {
  return {
    id: "agent_onboarding_blocker_v2",
    tenantId,
    key: "onboarding.blocker_escalation",
    name: "Onboarding blocker escalation",
    description:
      "Assess onboarding readiness, and when not ready notify owners and open a review for critical blockers.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        {
          id: "readiness",
          kind: "function",
          config: { functionKey: "onboarding.readiness_summary", input: {} },
        },
        {
          id: "gate",
          kind: "condition",
          config: { expression: "output.ready === false" },
        },
        {
          id: "notify",
          kind: "action",
          config: { actionKey: "onboarding.notify_owner", approvalExempt: true },
        },
        {
          id: "review",
          kind: "review",
          config: {
            caseType: "onboarding.case.critical",
            severity: "critical",
            summary: "Review escalated onboarding blockers",
          },
        },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "readiness" },
        { from: "readiness", to: "gate" },
        { from: "gate", to: "notify", condition: "output.ready === false" },
        { from: "notify", to: "review" },
        { from: "review", to: "out" },
      ],
    },
  };
}
