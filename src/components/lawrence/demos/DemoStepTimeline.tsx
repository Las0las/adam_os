"use client";

// Phase 8 — demo step timeline. Renders the scenario steps with per-step status
// derived from the actual run trace (pending when no result exists yet;
// completed/failed/skipped from the DemoRunStepResult). Selecting a step lifts
// it to the parent so the center/right panels can focus it.

import type {
  DemoScenario,
  DemoRunStepResult,
} from "@/lib/domain-packs/domain-pack-types";

export type StepStatus = "pending" | "completed" | "failed" | "skipped";

function statusTone(status: StepStatus): string {
  if (status === "completed") return "good";
  if (status === "failed") return "bad";
  if (status === "skipped") return "warn";
  return "neutral";
}

export function stepStatusFromTrace(
  results: DemoRunStepResult[],
  stepKey: string,
): StepStatus {
  const result = results.find((r) => r.stepKey === stepKey);
  return result ? result.status : "pending";
}

export function DemoStepTimeline({
  scenario,
  results,
  selectedKey,
  onSelect,
}: {
  scenario: DemoScenario;
  results: DemoRunStepResult[];
  selectedKey: string | null;
  onSelect: (stepKey: string) => void;
}) {
  return (
    <div className="card">
      <h3>Steps</h3>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {scenario.steps.map((step, i) => {
          const status = stepStatusFromTrace(results, step.key);
          const selected = selectedKey === step.key;
          return (
            <li key={step.key} style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`btn${selected ? " active" : ""}`}
                aria-pressed={selected}
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => onSelect(step.key)}
              >
                <span style={{ marginRight: 6 }}>{i + 1}.</span>
                {step.title}{" "}
                <span className={`badge ${statusTone(status)}`}>{status}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
