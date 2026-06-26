"use client";

// Phase 8 — navigation panel. Surfaces the navigateTo hrefs the demo run trace
// produced (Command Center / Object Detail / Mission Control / Observability /
// Evals) as clickable links so the operator can jump to the real surface that a
// step landed on.

import type { DemoRunStepResult } from "@/lib/domain-packs/domain-pack-types";

function labelFor(href: string): string {
  if (href.includes("command-center")) return "Command Center";
  if (href.includes("/objects/")) return "Object Detail";
  if (href.includes("mission-control")) return "Mission Control";
  if (href.includes("observability")) return "Observability";
  if (href.includes("evals")) return "Evals";
  return href;
}

export function DemoNavigationPanel({
  results,
}: {
  results: DemoRunStepResult[];
}) {
  const links = results
    .filter((r): r is DemoRunStepResult & { navigateTo: string } =>
      Boolean(r.navigateTo),
    )
    .map((r) => ({ stepKey: r.stepKey, href: r.navigateTo }));

  return (
    <div className="card">
      <h3>Navigation</h3>
      {links.length === 0 ? (
        <p className="muted">
          Navigation links appear here once steps run.
        </p>
      ) : (
        <ul>
          {links.map((link, i) => (
            <li key={`${link.stepKey}:${i}`}>
              <a href={link.href}>{labelFor(link.href)}</a>{" "}
              <span className="muted">({link.stepKey})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
