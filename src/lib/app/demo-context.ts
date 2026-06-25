// Helper for app routes: ensure the demo tenant is bootstrapped and hand back a
// system actor context. In production this is replaced by real auth/session.

import { ensureBootstrapped, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";

export async function appContext(): Promise<ActorContext> {
  await ensureBootstrapped();
  return systemActor(DEMO_TENANT_ID);
}
