// Request-scoped tenant context (§47). Carries the authenticated actor's tenant
// for the duration of an async request so the Postgres backend can set the
// `app.tenant_id` GUC that drives row-level security — including for operations
// whose signature carries no tenant (update/getById). Set once per request from
// the resolved ActorContext (appContext/systemContext) and per seed run
// (bootstrap). On the in-memory backend this is inert.

import { AsyncLocalStorage } from "node:async_hooks";

interface TenantContext {
  tenantId: string;
}

// Pin the store to globalThis: module-resolution can evaluate this file more than
// once (the `@/` alias vs a relative import, Next.js route-chunk duplication), and
// two AsyncLocalStorage instances would mean a tenant set on one is invisible to
// the other — silently dropping the RLS GUC. A process-wide singleton guarantees
// runWithTenant() and currentTenantId() share one store. (Same pattern as `db`.)
const globalRef = globalThis as unknown as {
  __lawrenceTenantStore?: AsyncLocalStorage<TenantContext>;
};
const storage: AsyncLocalStorage<TenantContext> =
  globalRef.__lawrenceTenantStore ??
  (globalRef.__lawrenceTenantStore = new AsyncLocalStorage<TenantContext>());

/** Run `fn` with the tenant bound for its entire async subtree. */
export function runWithTenant<R>(tenantId: string, fn: () => R): R {
  return storage.run({ tenantId }, fn);
}

/** Bind the tenant for the remainder of the current async context (request path). */
export function enterTenant(tenantId: string): void {
  storage.enterWith({ tenantId });
}

/** The tenant bound to the current async context, or null when none is set. */
export function currentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}
