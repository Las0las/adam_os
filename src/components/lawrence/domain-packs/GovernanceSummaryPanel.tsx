"use client";

// Phase 8 — governance controls summary panel built from manifest fields.

import type { DomainPackManifest } from "@/lib/domain-packs/domain-pack-types";

export function GovernanceSummaryPanel({
  manifest,
}: {
  manifest: DomainPackManifest;
}) {
  return (
    <div className="card">
      <h3>Governance controls</h3>
      {manifest.governanceControls.length === 0 ? (
        <p className="muted">No governance controls defined.</p>
      ) : (
        <ul>
          {manifest.governanceControls.map((control, i) => (
            <li key={i}>{control}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
