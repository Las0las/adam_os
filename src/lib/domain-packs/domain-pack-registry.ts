// Phase 8 — domain pack registry. In-code registry of pack manifests (the
// authoritative catalog). Packs self-register on import via the barrel.

import type { DomainPackManifest } from "./domain-pack-types";

const registry = new Map<string, DomainPackManifest>();

export function registerDomainPack(manifest: DomainPackManifest): void {
  registry.set(manifest.key, manifest);
}

export function listDomainPackManifests(): DomainPackManifest[] {
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getDomainPackManifest(key: string): DomainPackManifest | undefined {
  return registry.get(key);
}
