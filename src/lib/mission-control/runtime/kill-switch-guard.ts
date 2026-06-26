// Phase 6 — kill switch guard. The single chokepoint every runtime entrypoint
// calls before executing a component. If an enabled kill switch matches the
// component (either environment-specific or a global/null-environment switch),
// execution is refused fail-closed with a RuntimeKilledError.

import { getKillSwitch } from "./kill-switch-repository";
import type { RuntimeComponentType } from "./mission-control-hardening-types";

export class RuntimeKilledError extends Error {
  constructor(
    public readonly componentType: RuntimeComponentType,
    public readonly componentKey: string,
    public readonly reason?: string | null,
  ) {
    super(
      `Component ${componentType}:${componentKey} is disabled by kill switch` +
        (reason ? ` (${reason})` : ""),
    );
    this.name = "RuntimeKilledError";
  }
}

export async function isKilled(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
}): Promise<boolean> {
  return (await resolveActiveKill(input)) !== null;
}

async function resolveActiveKill(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
}): Promise<{ reason?: string | null } | null> {
  // Environment-specific switch first, then the global (null-environment) switch.
  const envSwitch = input.environmentId
    ? await getKillSwitch(
        input.tenantId,
        input.componentType,
        input.componentKey,
        input.environmentId,
      )
    : undefined;
  if (envSwitch?.enabled) return { reason: envSwitch.reason };

  const globalSwitch = await getKillSwitch(
    input.tenantId,
    input.componentType,
    input.componentKey,
    null,
  );
  if (globalSwitch?.enabled) return { reason: globalSwitch.reason };

  return null;
}

export async function assertNotKilled(input: {
  tenantId: string;
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentId?: string | null;
}): Promise<void> {
  const active = await resolveActiveKill(input);
  if (active) {
    throw new RuntimeKilledError(input.componentType, input.componentKey, active.reason);
  }
}
