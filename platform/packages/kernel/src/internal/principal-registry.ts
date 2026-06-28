/**
 * INTERNAL — kernel-private. The principal registry resolves an opaque token to a
 * Principal, scoped to a tenant. Real deployments back this with the Authentication
 * host service; here it is a deterministic, seedable in-memory map so the kernel is
 * testable in isolation. Resolution is deny-by-default: an unknown token, or a token
 * whose principal belongs to a different tenant, resolves to nothing.
 */
import type { Principal, TenantContext, TenantId } from "@lawrence/contracts";

export interface SeedPrincipal extends Principal {
  /** The opaque bearer token that resolves to this principal. */
  readonly token: string;
}

export class PrincipalRegistry {
  private readonly byToken = new Map<string, Principal>();

  constructor(seed: readonly SeedPrincipal[] = []) {
    for (const p of seed) this.seed(p);
  }

  seed(entry: SeedPrincipal): void {
    const { token, ...principal } = entry;
    this.byToken.set(token, Object.freeze(principal));
  }

  /**
   * Resolve a token within a tenant boundary. Returns null when the token is
   * unknown OR when the resolved principal is not a member of ctx.tenantId
   * (CCR-003 — no cross-tenant resolution).
   */
  resolve(token: string, ctx: TenantContext): Principal | null {
    const principal = this.byToken.get(token);
    if (!principal) return null;
    if (principal.tenantId !== ctx.tenantId) return null;
    return principal;
  }

  has(tenantId: TenantId, principalId: string): boolean {
    for (const p of this.byToken.values()) {
      if (p.tenantId === tenantId && p.id === principalId) return true;
    }
    return false;
  }
}
