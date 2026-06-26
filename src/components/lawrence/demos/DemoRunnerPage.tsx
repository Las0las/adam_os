"use client";

// Phase 8 — demo runner client root. Three-column layout: left timeline, center
// step explanation + run controls, right outcome + navigation. "Run all"
// executes the whole demo via the API; "Run step" runs the focused step. All
// rendered status/artifacts/links come straight from the real run trace.

import { useCallback, useMemo, useState } from "react";
import type {
  DemoScenario,
  DemoRunStepResult,
  DomainPackDemoRun,
} from "@/lib/domain-packs/domain-pack-types";
import { useDemoRunner } from "@/components/lawrence/hooks/useDemoRunner";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { DemoStepTimeline } from "./DemoStepTimeline";
import { DemoOutcomePanel } from "./DemoOutcomePanel";
import { DemoNavigationPanel } from "./DemoNavigationPanel";
import { DemoResetButton } from "./DemoResetButton";

export function DemoRunnerPage({
  packKey,
  demoKey,
  scenario,
}: {
  packKey: string;
  demoKey: string;
  scenario: DemoScenario;
}) {
  // Real results from the API — never fabricated. Keyed by stepKey so single
  // steps can update independently of a full run.
  const [results, setResults] = useState<Record<string, DemoRunStepResult>>({});
  const [run, setRun] = useState<DomainPackDemoRun | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    scenario.steps[0]?.key ?? null,
  );

  const noop = useCallback(() => {}, []);
  const { pending, error, run: runDemo, runStep } = useDemoRunner(noop);

  const resultsList = useMemo(() => Object.values(results), [results]);

  const handleRunAll = useCallback(async () => {
    const res = await runDemo(packKey, demoKey);
    if (res.ok && res.data) {
      setRun(res.data);
      const next: Record<string, DemoRunStepResult> = {};
      for (const step of res.data.trace.steps) next[step.stepKey] = step;
      setResults(next);
    }
  }, [runDemo, packKey, demoKey]);

  const handleRunStep = useCallback(async () => {
    if (!selectedKey) return;
    const res = await runStep(packKey, demoKey, selectedKey);
    if (res.ok && res.data) {
      const stepResult = res.data;
      setResults((prev) => ({ ...prev, [stepResult.stepKey]: stepResult }));
    }
  }, [runStep, packKey, demoKey, selectedKey]);

  const handleResetSettled = useCallback(() => {
    setResults({});
    setRun(null);
  }, []);

  const selectedStep = useMemo(
    () => scenario.steps.find((s) => s.key === selectedKey) ?? null,
    [scenario.steps, selectedKey],
  );
  const selectedResult = selectedKey ? results[selectedKey] ?? null : null;

  return (
    <>
      <PageHeader title={scenario.name} sub={scenario.description} />

      <div className="btn-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <span className="badge warn">DEMO</span>
        <span className="badge neutral">{scenario.persona}</span>
        <span className="badge neutral">~{scenario.estimatedMinutes} min</span>
        <span className="badge neutral">{packKey}</span>
        {run ? (
          <span
            className={`badge ${
              run.status === "completed"
                ? "good"
                : run.status === "failed"
                  ? "bad"
                  : "neutral"
            }`}
          >
            run {run.status}
          </span>
        ) : null}
      </div>

      <p style={{ marginTop: 8 }}>
        <a href={`/demos/${encodeURIComponent(packKey)}`}>← Back to demos</a>
      </p>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="badge bad">{error}</p>
        </div>
      ) : null}

      <div className="cc-grid" style={{ marginTop: 16 }}>
        <div className="cc-col">
          <DemoStepTimeline
            scenario={scenario}
            results={resultsList}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        </div>

        <div className="cc-col">
          <div className="card">
            <h3>Current step</h3>
            {selectedStep ? (
              <>
                <h4 style={{ marginBottom: 4 }}>{selectedStep.title}</h4>
                <p className="muted">{selectedStep.description}</p>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <span className="badge neutral">{selectedStep.action}</span>
                </div>
              </>
            ) : (
              <p className="muted">No step selected.</p>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => void handleRunAll()}
              >
                {pending ? "Running…" : "Run all"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={pending || !selectedKey}
                onClick={() => void handleRunStep()}
              >
                Run step
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Reset</h3>
            <p className="muted">
              Clears demo objects and run traces for this scenario.
            </p>
            <DemoResetButton
              packKey={packKey}
              demoKey={demoKey}
              onSettled={handleResetSettled}
            />
          </div>
        </div>

        <div className="cc-col">
          <DemoOutcomePanel step={selectedStep} result={selectedResult} />
          <DemoNavigationPanel results={resultsList} />
        </div>
      </div>
    </>
  );
}
