// Request actor-context resolution (§7, §47). This is the production identity
// seam: `appContext()` resolves the authenticated Clerk session into the
// platform ActorContext (real tenant + user + permissions). Without a session it
// falls back to the demo system actor ONLY where that is safe (dev/test, Clerk
// unconfigured, or an explicit demo override); in production with Clerk
// configured it fails closed. Machine routes (webhooks/jobs) that authenticate
// by their own mechanism use `systemContext()`, not a user session.

import { auth } from "@clerk/nextjs/server";
import { ensureBootstrapped, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { enterTenant } from "@/lib/lawrence-core/db/tenant-store";
import { ensureTenant, ensureUser, resolveUserPermissions } from "@/lib/setup/tenant-provisioning-service";
import type { ActorContext, Permission } from "@/types/platform";

type Env = Record<string, string | undefined>;

/** Clerk is wired when both server and publishable keys are present. */
export function isClerkConfigured(env: Env = process.env): boolean {
  return Boolean(env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/**
 * Whether the demo system actor may stand in for a real session. Allowed in
 * dev/test, when Clerk is not configured outside production, or via an explicit
 * override. Once Clerk is configured, a real session is always required (the
 * demo god-mode actor is never silently granted).
 */
export function shouldAllowDemoAuth(env: Env = process.env): boolean {
  if (env.LAWRENCE_ALLOW_DEMO_AUTH === "1") return true;
  if (isClerkConfigured(env)) return false;
  return env.NODE_ENV !== "production";
}

/**
 * Resolve the operating tenant. A Clerk organization maps to a tenant; a
 * single-tenant deployment (no org) maps every user to LAWRENCE_DEFAULT_TENANT_ID
 * (default: the seeded demo tenant) so existing data stays reachable.
 */
export function resolveTenantId(orgId: string | null | undefined, env: Env = process.env): string {
  return orgId || env.LAWRENCE_DEFAULT_TENANT_ID || DEMO_TENANT_ID;
}

const ALL_PERMISSIONS: Permission[] = [
  "dataops.admin",
  "ontology.admin",
  "aiops.function_admin",
  "aiops.agent_admin",
  "review.reviewer",
  "mission_control.admin",
  "deploy.promote",
  "notifications.manage",
  "integrations.manage",
];

/**
 * Fallback permission grant from the Clerk org role, used when a user somehow has
 * no provisioned app roles. Admins receive full platform authority; everyone else
 * receives the least-privilege reviewer baseline. DB-backed role resolution (via
 * provisioning) takes precedence.
 */
export function permissionsForOrgRole(orgRole: string | null | undefined): Permission[] {
  if (orgRole === "org:admin" || orgRole === "admin") return [...ALL_PERMISSIONS];
  return ["review.reviewer"];
}

/**
 * Build an ActorContext from the active Clerk session, or null if none/unconfigured.
 * Provisions the tenant + app user just-in-time so permissions resolve from the
 * existing user/role model (the app user id is the Clerk user id). The org-role
 * grant remains a fallback if a user somehow has no roles.
 */
async function resolveClerkActor(): Promise<ActorContext | null> {
  if (!isClerkConfigured()) return null;
  try {
    const session = await auth();
    const userId = session.userId;
    if (!userId) return null;
    const tenantId = resolveTenantId(session.orgId);
    // Bind the tenant before provisioning so the writes satisfy row-level security.
    enterTenant(tenantId);
    const email = (session.sessionClaims?.email as string | undefined) ?? null;
    const displayName = (session.sessionClaims?.name as string | undefined) ?? null;
    await ensureTenant(tenantId);
    const user = await ensureUser(tenantId, { userId, email, displayName, orgRole: session.orgRole });
    const permissions = await resolveUserPermissions(tenantId, user);
    return {
      tenantId,
      actorUserId: userId,
      permissions: permissions.length > 0 ? permissions : permissionsForOrgRole(session.orgRole),
    };
  } catch {
    // Not inside a Clerk request context (e.g. tests/jobs) — defer to fallback.
    return null;
  }
}

/**
 * The authenticated user context for interactive routes. Resolves the Clerk
 * session; otherwise applies the demo fallback where safe, and fails closed in
 * production when Clerk is configured but no session is present.
 */
export async function appContext(): Promise<ActorContext> {
  await ensureBootstrapped();
  const actor = await resolveClerkActor();
  if (actor) {
    enterTenant(actor.tenantId);
    return actor;
  }
  if (shouldAllowDemoAuth()) {
    const demo = systemActor(resolveTenantId(null));
    enterTenant(demo.tenantId);
    return demo;
  }
  throw new Error("Unauthenticated: an active session is required (auth enforced in production).");
}

/**
 * Machine/system actor for non-interactive routes (inbound webhooks, jobs) that
 * authenticate by their own mechanism rather than a user session. Behavior is
 * identical to the prior demo system actor.
 */
export async function systemContext(): Promise<ActorContext> {
  await ensureBootstrapped();
  const ctx = systemActor(resolveTenantId(null));
  enterTenant(ctx.tenantId);
  return ctx;
}
