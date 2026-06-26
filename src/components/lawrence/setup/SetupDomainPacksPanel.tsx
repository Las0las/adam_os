"use client";

// Phase 9 — domain packs setup step body. Installs the default pack bundle via
// the setup API and links to the full domain pack catalog.

import { useState } from "react";
import { PACK_BUNDLES } from "@/lib/setup/default-domain-pack-plan";
import type { BootstrapResult } from "@/lib/setup/tenant-bootstrap-types";
import { useSetupActions } from "@/components/lawrence/hooks/useSetupActions";

export function SetupDomainPacksPanel() {
  const [bundleKey, setBundleKey] = useState<string>(PACK_BUNDLES[0]?.key ?? "");
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const { pending, error, installPacks } = useSetupActions(() => {});

  async function handleInstall() {
    const res = await installPacks(bundleKey || undefined);
    if (res.ok && res.data) setResult(res.data);
  }

  return (
    <div className="card">
      <strong>Install default packs</strong>
      <p className="muted" style={{ marginTop: 4 }}>
        Installs the domain packs in the selected bundle. Manage every pack from the{" "}
        <a href="/domain-packs">domain pack catalog</a>.
      </p>

      <div className="field">
        <label htmlFor="pack-bundle">Pack bundle</label>
        <select id="pack-bundle" value={bundleKey} onChange={(e) => setBundleKey(e.target.value)}>
          {PACK_BUNDLES.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="badge bad">{error}</p> : null}

      <div className="btn-row">
        <button type="button" className="btn" onClick={handleInstall} disabled={pending}>
          {pending ? "Installing…" : "Install default packs"}
        </button>
      </div>

      {result ? (
        <p className="badge good" style={{ marginTop: 8 }}>
          Installed packs: {result.packsInstalled.join(", ") || "none"}
        </p>
      ) : null}
    </div>
  );
}
