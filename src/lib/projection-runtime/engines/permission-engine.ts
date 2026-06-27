// PermissionEngine — decides whether the operator may see/emit an intent and
// whether a field is editable. Permission logic lives here (and is mirrored
// server-side by the action engine's own requirePermission), never in the UI.

import type { Permission } from "@/types/platform";
import type { IntentDefinition } from "../contracts/enterprise-object";
import type { PermissionContext } from "../contracts/context";

export function hasPermission(ctx: PermissionContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

export interface IntentPermissionDecision {
  enabled: boolean;
  reason?: string;
}

/** Whether the operator may emit an intent. A missing required permission
 *  disables (but still shows) the intent with a reason — fail-closed. */
export function canEmitIntent(
  ctx: PermissionContext,
  intent: IntentDefinition,
): IntentPermissionDecision {
  if (intent.requiredPermission && !hasPermission(ctx, intent.requiredPermission)) {
    return { enabled: false, reason: `Requires permission: ${intent.requiredPermission}` };
  }
  return { enabled: true };
}
