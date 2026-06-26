"use client";

// Phase 9 — Mission Control setup step body. Seeds default environments and
// approval policies via the setup API, and links to Mission Control.

import { useState } from "react";
import { useSetupActions } from "@/components/lawrence/hooks/useSetupActions";

export function SetupMissionControlPanel() {
  const [done, setDone] = useState<string[]>([]);
  const { pending, error, createEnvironments, createApprovalPolicies } = useSetupActions(() => {});

  async function handleEnvironments() {
    const res = await createEnvironments();
    if (res.ok) setDone((d) => (d.includes("environments") ? d : [...d, "environments"]));
  }

  async function handlePolicies() {
    const res = await createApprovalPolicies();
    if (res.ok) setDone((d) => (d.includes("policies") ? d : [...d, "policies"]));
  }

  return (
    <div className="card">
      <strong>Mission Control governance</strong>
      <p className="muted" style={{ marginTop: 4 }}>
        Create the default dev/staging/prod environments and approval policies, then
        open <a href="/mission-control">Mission Control</a>.
      </p>

      {error ? <p className="badge bad">{error}</p> : null}

      <div className="btn-row">
        <button type="button" className="btn" onClick={handleEnvironments} disabled={pending}>
          {done.includes("environments") ? "Environments created ✓" : "Create default environments"}
        </button>
        <button type="button" className="btn" onClick={handlePolicies} disabled={pending}>
          {done.includes("policies") ? "Policies created ✓" : "Create default approval policies"}
        </button>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Continue to <a href="/setup/complete">complete setup</a>.
      </p>
    </div>
  );
}
