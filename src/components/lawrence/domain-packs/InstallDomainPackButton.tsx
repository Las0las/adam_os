"use client";

// Phase 8 — install / uninstall control for a domain pack. Installs via
// usePackActions; disables while pending; shows "Installed" once the entry is
// installed and offers an Uninstall button with a "remove demo data" checkbox.

import { useState } from "react";
import type { DomainPackCatalogEntry } from "@/lib/domain-packs/domain-pack-types";
import { usePackActions } from "@/components/lawrence/hooks/usePackActions";

export function InstallDomainPackButton({
  entry,
  onSettled,
}: {
  entry: DomainPackCatalogEntry;
  onSettled: () => void;
}) {
  const { pending, error, install, uninstall } = usePackActions(onSettled);
  const [removeDemoData, setRemoveDemoData] = useState(false);
  const packKey = entry.manifest.key;

  return (
    <div>
      {entry.installed ? (
        <>
          <div className="btn-row">
            <span className="badge good">Installed</span>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => void uninstall(packKey, removeDemoData)}
            >
              {pending ? "Working…" : "Uninstall"}
            </button>
          </div>
          <label className="row" style={{ marginTop: 8, gap: 6 }}>
            <input
              type="checkbox"
              checked={removeDemoData}
              disabled={pending}
              onChange={(e) => setRemoveDemoData(e.target.checked)}
            />
            <span className="muted">Remove demo data</span>
          </label>
        </>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => void install(packKey)}
          >
            {pending ? "Installing…" : "Install"}
          </button>
        </div>
      )}

      {error ? (
        <p className="badge bad" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
