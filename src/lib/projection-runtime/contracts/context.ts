// Universal Projection Runtime — the contexts threaded into every resolve().
//
// The runtime is a pure function of (object definition, projection definition,
// + these contexts). Separating them keeps resolution deterministic and lets the
// same projection resolve differently per user, permission set, policy posture,
// or runtime surface override.

import type { Permission } from "@/types/platform";

/** A minimal, serializable snapshot of a canonical object instance, used by the
 *  BindingEngine to seed initial values for edit/view projections. Mirrors the
 *  subset of OntologyObject the runtime needs. Absent for `create`. */
export interface ObjectInstanceSnapshot {
  objectType: string;
  id?: string;
  title?: string | null;
  status?: string | null;
  properties?: Record<string, unknown>;
}

/** Who is operating the surface. */
export interface UserContext {
  tenantId: string;
  userId: string | null;
  displayName?: string | null;
}

/** What the operator is allowed to do (drives the PermissionEngine). */
export interface PermissionContext {
  permissions: Permission[];
}

/** Governance posture for intent emission (drives the PolicyEngine). Intent
 *  names listed here are forced through approval regardless of their definition. */
export interface PolicyContext {
  requireApprovalFor?: string[];
  /** Intent names that are hard-blocked in the current posture. */
  blockedIntents?: string[];
}

/** Telemetry sink — implemented by TelemetryEmitter. Kept on the context so the
 *  composer can record resolution without importing a server-only emitter. */
export interface TelemetrySink {
  emit(event: { name: string; at: string; data?: Record<string, unknown> }): void;
}

/** Runtime/environment inputs: the clock, an optional surface override, the
 *  bound instance (for edit/view), and an optional telemetry sink. */
export interface RuntimeContext {
  now: string;
  surfaceOverride?: import("./projection-definition").SurfaceKind;
  instance?: ObjectInstanceSnapshot | null;
  telemetry?: TelemetrySink;
  locale?: string;
}
