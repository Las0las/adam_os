"use client";

// Phase 9 — tenant bootstrap step body. Lets the operator pick a pack bundle and
// bootstrap the tenant via the setup API, then shows the BootstrapResult.

import { useState } from "react";
import { PACK_BUNDLES } from "@/lib/setup/default-domain-pack-plan";
import type { BootstrapResult } from "@/lib/setup/tenant-bootstrap-types";
import { useSetupActions } from "@/components/lawrence/hooks/useSetupActions";

export function SetupBootstrapPanel() {
  const [bundleKey, setBundleKey] = useState<string>(PACK_BUNDLES[0]?.key ?? "");
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const { pending, error, bootstrap } = useSetupActions(() => {});

  async function handleBootstrap() {
    const res = await bootstrap(bundleKey ? { bundleKey } : {});
    if (res.ok && res.data) setResult(res.data);
  }

  return (
    <div className="card">
      <strong>Bootstrap tenant</strong>
      <p className="muted" style={{ marginTop: 4 }}>
        Seeds environments, approval policies, roles, eval suites, and installs the
        selected pack bundle.
      </p>

      <div className="field">
        <label htmlFor="bundle">Pack bundle</label>
        <select id="bundle" value={bundleKey} onChange={(e) => setBundleKey(e.target.value)}>
          {PACK_BUNDLES.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="badge bad">{error}</p> : null}

      <div className="btn-row">
        <button type="button" className="btn" onClick={handleBootstrap} disabled={pending}>
          {pending ? "Bootstrapping…" : "Bootstrap tenant"}
        </button>
      </div>

      {result ? (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Bootstrap result</strong>
          <div className="row">
            <span className="muted">Environments created</span>
            <span>{result.environmentsCreated}</span>
          </div>
          <div className="row">
            <span className="muted">Approval policies created</span>
            <span>{result.approvalPoliciesCreated}</span>
          </div>
          <div className="row">
            <span className="muted">Roles created</span>
            <span>{result.rolesCreated}</span>
          </div>
          <div className="row">
            <span className="muted">Packs installed</span>
            <span>{result.packsInstalled.join(", ") || "—"}</span>
          </div>
          <div className="row">
            <span className="muted">Eval suites installed</span>
            <span>{result.evalSuitesInstalled}</span>
          </div>
          <div className="row">
            <span className="muted">Integration shells created</span>
            <span>{result.integrationShellsCreated}</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Continue to <a href="/setup/integrations">integrations</a>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
