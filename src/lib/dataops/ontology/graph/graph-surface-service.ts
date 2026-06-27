// VS-006 — Graph Integrity Review Surface (service). Server-side: loads the tenant
// graph, runs the VS-005 validateGraph() in WARN mode (so review never throws),
// and returns the presenter view-model. Read-only and user-triggered — it never
// writes and never changes object/relationship write behavior.

import { db } from "@/lib/lawrence-core/db";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import { validateGraph } from "./graph-integrity";
import { resolveGraphEnforcementMode } from "./graph-enforcement";
import { buildGraphIntegritySurface, type GraphIntegritySurface } from "./graph-surface";
import type { OntologyGraph } from "./graph-types";

export interface GraphIntegritySurfaceOptions {
  /** Optional scope: validate only objects of these types (and the edges between
   *  them). Omitted/empty = the whole tenant graph. */
  objectTypes?: string[];
}

/**
 * Build the Graph Integrity review surface for a tenant. Always validates in warn
 * mode (the review must never throw); the surface reports whether the configured
 * mode WOULD reject. Requires `ontology.admin` (read-only governance review).
 */
export async function getGraphIntegritySurface(
  ctx: ActorContext,
  opts: GraphIntegritySurfaceOptions = {},
): Promise<GraphIntegritySurface> {
  requirePermission(ctx, "ontology.admin");

  const scope = (opts.objectTypes ?? []).filter((t) => t.trim().length > 0);
  const [objects, links] = await Promise.all([
    db.ontologyObjects.list(ctx.tenantId),
    db.ontologyLinks.list(ctx.tenantId),
  ]);

  let graph: OntologyGraph = { objects, links };
  if (scope.length > 0) {
    const allow = new Set(scope);
    const scopedObjects = objects.filter((o) => allow.has(o.objectType));
    const ids = new Set(scopedObjects.map((o) => o.id));
    const scopedLinks = links.filter((l) => ids.has(l.fromObjectId) && ids.has(l.toObjectId));
    graph = { objects: scopedObjects, links: scopedLinks };
  }

  // Review is always warn-mode (never throws); the presenter surfaces whether the
  // tenant's configured mode would reject.
  const report = await validateGraph(ctx, { graph, mode: "warn" });
  const resolvedMode = resolveGraphEnforcementMode(ctx.tenantId);

  return buildGraphIntegritySurface(report, resolvedMode, {
    scope: "tenant",
    objectTypes: scope.length > 0 ? [...scope].sort() : null,
  });
}
