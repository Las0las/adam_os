// Phase 8 — domain pack service. Read surfaces for the catalog + detail pages,
// composing the in-code manifest registry with per-tenant installation state.

import "./packs"; // ensure all pack manifests are registered
import { db } from "@/lib/lawrence-core/db";
import { listDomainPackManifests, getDomainPackManifest } from "./domain-pack-registry";
import type { ActorContext } from "@/types/platform";
import type {
  DomainPackCatalogEntry,
  DomainPackInstallation,
  DomainPackManifest,
} from "./domain-pack-types";

async function installedVersions(ctx: ActorContext): Promise<Map<string, DomainPackInstallation>> {
  const installs = await db.domainPackInstallations.list(ctx.tenantId, (i) => i.status === "installed");
  const map = new Map<string, DomainPackInstallation>();
  for (const i of installs) map.set(i.packKey, i);
  return map;
}

function entry(manifest: DomainPackManifest, install?: DomainPackInstallation): DomainPackCatalogEntry {
  return {
    manifest,
    installed: Boolean(install),
    installedVersion: install?.packVersion ?? null,
    objectCount: manifest.objectTypes.length,
    workflowCount: manifest.functions.length + manifest.agents.length,
    demoCount: manifest.demoScenarios.length,
  };
}

export async function getDomainPackCatalog(ctx: ActorContext): Promise<DomainPackCatalogEntry[]> {
  const installs = await installedVersions(ctx);
  return listDomainPackManifests().map((m) => entry(m, installs.get(m.key)));
}

export async function getDomainPackDetail(
  ctx: ActorContext,
  packKey: string,
): Promise<{
  entry: DomainPackCatalogEntry;
  installations: DomainPackInstallation[];
} | null> {
  const manifest = getDomainPackManifest(packKey);
  if (!manifest) return null;
  const installs = await installedVersions(ctx);
  const installations = (await db.domainPackInstallations.list(ctx.tenantId, (i) => i.packKey === packKey))
    .sort((a, b) => b.installedAt.localeCompare(a.installedAt));
  return { entry: entry(manifest, installs.get(packKey)), installations };
}

export async function listInstallations(ctx: ActorContext): Promise<DomainPackInstallation[]> {
  return (await db.domainPackInstallations.list(ctx.tenantId)).sort((a, b) =>
    b.installedAt.localeCompare(a.installedAt),
  );
}
