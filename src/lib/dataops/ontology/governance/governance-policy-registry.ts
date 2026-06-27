// VS-008 — governance policy registry (EXTENSION POINT ONLY). Provides the
// registry + execution surface for pluggable policies; it deliberately ships NO
// business policies. Implementations register from outside this layer.

import type { GovernancePolicy, GovernancePolicyContext, GovernanceFinding } from "./governance-types";

const POLICIES = new Map<string, GovernancePolicy>();

/** Register a governance policy (idempotent by id; last registration wins). */
export function registerGovernancePolicy(policy: GovernancePolicy): void {
  POLICIES.set(policy.id, policy);
}

export function unregisterGovernancePolicy(id: string): void {
  POLICIES.delete(id);
}

/** All registered policies, ordered by id for deterministic execution. */
export function listGovernancePolicies(): GovernancePolicy[] {
  return [...POLICIES.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Clear all registered policies (test isolation). */
export function clearGovernancePolicies(): void {
  POLICIES.clear();
}

/** Run every registered policy deterministically (sorted by id) and collect
 *  findings. Total: a throwing policy is isolated and reported as a finding so one
 *  bad policy cannot abort the pipeline. */
export async function runGovernancePolicies(input: GovernancePolicyContext): Promise<GovernanceFinding[]> {
  const out: GovernanceFinding[] = [];
  for (const policy of listGovernancePolicies()) {
    try {
      const findings = await policy.evaluate(input);
      for (const f of findings) out.push({ ...f, stage: "policy" });
    } catch (err) {
      out.push({
        stage: "policy",
        code: "POLICY_EVALUATION_ERROR",
        severity: "warning",
        message: `Policy "${policy.id}" failed to evaluate: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return out;
}
