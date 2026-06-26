"use client";

// Phase 8 — business value + success metrics panel built from manifest fields.

import type { DomainPackManifest } from "@/lib/domain-packs/domain-pack-types";

export function DemoValuePanel({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <div className="card">
      <h3>Business value</h3>
      <p>{manifest.businessValue}</p>

      <h4 style={{ marginTop: 12 }}>Success metrics</h4>
      {manifest.successMetrics.length === 0 ? (
        <p className="muted">No success metrics defined.</p>
      ) : (
        <ul>
          {manifest.successMetrics.map((metric, i) => (
            <li key={i}>{metric}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
