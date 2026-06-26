"use client";

// Phase 8 — catalog card for a single domain pack. Shows name/category/version,
// description, installed badge, object/workflow/demo counts, install control and
// a link to the detail page.

import type { DomainPackCatalogEntry } from "@/lib/domain-packs/domain-pack-types";
import { InstalledPackBadge } from "./InstalledPackBadge";
import { InstallDomainPackButton } from "./InstallDomainPackButton";

export function DomainPackCard({
  entry,
  onSettled,
}: {
  entry: DomainPackCatalogEntry;
  onSettled: () => void;
}) {
  const { manifest } = entry;

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>
          <a href={`/domain-packs/${encodeURIComponent(manifest.key)}`}>
            {manifest.name}
          </a>
        </h3>
        <InstalledPackBadge
          installed={entry.installed}
          version={entry.installedVersion}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 4 }}>
        <span className="badge neutral">{manifest.category}</span>
        <span className="badge neutral">v{manifest.version}</span>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        {manifest.description}
      </p>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <span className="badge neutral">{entry.objectCount} objects</span>
        <span className="badge neutral">{entry.workflowCount} workflows</span>
        <span className="badge neutral">{entry.demoCount} demos</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <InstallDomainPackButton entry={entry} onSettled={onSettled} />
      </div>

      <p style={{ marginTop: 8 }}>
        <a href={`/domain-packs/${encodeURIComponent(manifest.key)}`}>
          View details →
        </a>
      </p>
    </div>
  );
}
