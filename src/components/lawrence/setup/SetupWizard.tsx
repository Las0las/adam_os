"use client";

// Phase 9 — setup wizard chrome. Renders the ordered step navigation shared
// across the setup pages and highlights the active step. Each page supplies its
// own body; this component just provides the step rail and wrapper.

import type { ReactNode } from "react";

export interface SetupStep {
  key: string;
  label: string;
  href: string;
}

export const SETUP_STEPS: SetupStep[] = [
  { key: "tenant", label: "1. Bootstrap tenant", href: "/setup" },
  { key: "integrations", label: "2. Integrations", href: "/setup/integrations" },
  { key: "domain-packs", label: "3. Domain packs", href: "/setup/domain-packs" },
  { key: "mission-control", label: "4. Mission Control", href: "/setup/mission-control" },
  { key: "complete", label: "5. Complete", href: "/setup/complete" },
];

export function SetupWizard({ active, children }: { active: string; children: ReactNode }) {
  return (
    <>
      <div className="card">
        <div className="btn-row">
          {SETUP_STEPS.map((step) => (
            <a
              key={step.key}
              className={`badge ${step.key === active ? "good" : "neutral"}`}
              href={step.href}
            >
              {step.label}
            </a>
          ))}
        </div>
      </div>
      {children}
    </>
  );
}
