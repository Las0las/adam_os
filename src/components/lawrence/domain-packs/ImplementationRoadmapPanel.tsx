"use client";

// Phase 8 — implementation roadmap + required integrations + data requirements
// panel, built from manifest fields.

import type { DomainPackManifest } from "@/lib/domain-packs/domain-pack-types";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImplementationRoadmapPanel({
  manifest,
}: {
  manifest: DomainPackManifest;
}) {
  return (
    <div className="card">
      <h3>Implementation roadmap</h3>
      {manifest.implementationRoadmap.length === 0 ? (
        <p className="muted">No roadmap defined.</p>
      ) : (
        <ol>
          {manifest.implementationRoadmap.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      <List title="Required integrations" items={manifest.requiredIntegrations} />
      <List title="Data required" items={manifest.dataRequired} />
    </div>
  );
}
