// IOS-011 — Circuit Breaker — failure classifier.
//
// Deterministic: a failure counts toward tripping the circuit only when its
// normalized kind is in the policy's tripping classes (default: timeout,
// rate_limit, provider_unavailable). Authentication, validation, security, and
// generic execution errors do not trip the breaker — they are not signals of a
// transiently unhealthy provider. (Security/validation failures occur outside the
// provider invocation and never reach the breaker regardless.)

import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { CircuitPolicy } from "./circuit-types";

export function tripsCircuit(kind: ExecutionErrorKind, policy: CircuitPolicy): boolean {
  return policy.trippingErrorClasses.includes(kind);
}
