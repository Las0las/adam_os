"use client";

// Phase 8 — card for a single demo scenario: name, persona, estimated minutes,
// description, and a link to the runner page.

import type { DemoScenario } from "@/lib/domain-packs/domain-pack-types";

export function DemoScenarioCard({ scenario }: { scenario: DemoScenario }) {
  const href = `/demos/${encodeURIComponent(scenario.packKey)}/${encodeURIComponent(
    scenario.key,
  )}`;

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>
          <a href={href}>{scenario.name}</a>
        </h3>
        <span className="badge neutral">{scenario.persona}</span>
      </div>

      <div className="btn-row" style={{ marginTop: 4 }}>
        <span className="badge neutral">~{scenario.estimatedMinutes} min</span>
        <span className="badge neutral">{scenario.packKey}</span>
        <span className="badge neutral">{scenario.steps.length} steps</span>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        {scenario.description}
      </p>

      <p style={{ marginTop: 8 }}>
        <a href={href}>Open demo runner →</a>
      </p>
    </div>
  );
}
