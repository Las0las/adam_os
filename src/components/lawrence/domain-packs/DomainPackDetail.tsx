"use client";

// Phase 8 — domain pack detail client root. Loads the pack detail (entry +
// installations) and renders manifest tabs (Overview / Objects / Workflows /
// Evals / Demos / Installation History) plus the value, roadmap and governance
// panels. Install/uninstall actions refetch via the hook's refresh.

import { useState } from "react";
import type {
  DomainPackInstallation,
  DomainPackManifest,
} from "@/lib/domain-packs/domain-pack-types";
import { useDomainPackDetail } from "@/components/lawrence/hooks/useDomainPackDetail";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { InstalledPackBadge } from "./InstalledPackBadge";
import { InstallDomainPackButton } from "./InstallDomainPackButton";
import { DemoValuePanel } from "./DemoValuePanel";
import { ImplementationRoadmapPanel } from "./ImplementationRoadmapPanel";
import { GovernanceSummaryPanel } from "./GovernanceSummaryPanel";

type TabKey =
  | "overview"
  | "objects"
  | "workflows"
  | "evals"
  | "demos"
  | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "objects", label: "Objects" },
  { key: "workflows", label: "Workflows" },
  { key: "evals", label: "Evals" },
  { key: "demos", label: "Demos" },
  { key: "history", label: "Installation History" },
];

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="btn-row" style={{ flexWrap: "wrap" }}>
      {items.map((item) => (
        <span className="badge neutral" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function OverviewTab({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <>
      <div className="card">
        <h3>Description</h3>
        <p>{manifest.description}</p>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <span className="badge neutral">{manifest.category}</span>
          <span className="badge neutral">v{manifest.version}</span>
        </div>
      </div>
      <DemoValuePanel manifest={manifest} />
      <ImplementationRoadmapPanel manifest={manifest} />
      <GovernanceSummaryPanel manifest={manifest} />
    </>
  );
}

function ObjectsTab({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <div className="card">
      <h3>Object types</h3>
      <Chips items={manifest.objectTypes} empty="No object types." />
      <h3 style={{ marginTop: 16 }}>Link types</h3>
      <Chips items={manifest.linkTypes} empty="No link types." />
      <h3 style={{ marginTop: 16 }}>Sample objects</h3>
      <p className="muted">{manifest.sampleObjects.length} sample object(s).</p>
    </div>
  );
}

function WorkflowsTab({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <div className="card">
      <h3>Functions</h3>
      <Chips items={manifest.functions} empty="No functions." />
      <h3 style={{ marginTop: 16 }}>Agents</h3>
      <Chips items={manifest.agents} empty="No agents." />
      <h3 style={{ marginTop: 16 }}>Actions</h3>
      <Chips items={manifest.actions} empty="No actions." />
      <h3 style={{ marginTop: 16 }}>Notification rules</h3>
      {manifest.notificationRules.length === 0 ? (
        <p className="muted">No notification rules.</p>
      ) : (
        <ul>
          {manifest.notificationRules.map((rule, i) => (
            <li key={i}>
              <strong>{rule.name}</strong> — {rule.eventKey} via {rule.channel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvalsTab({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <div className="card">
      <h3>Eval suites</h3>
      {manifest.evalSuites.length === 0 ? (
        <p className="muted">No eval suites.</p>
      ) : (
        <ul>
          {manifest.evalSuites.map((suite) => (
            <li key={suite.key}>
              <strong>{suite.name}</strong> — {suite.suiteType} on{" "}
              {suite.targetComponentKey} (baseline{" "}
              {(suite.baselineScore * 100).toFixed(0)}%)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DemosTab({ manifest }: { manifest: DomainPackManifest }) {
  return (
    <div className="card">
      <h3>Demo scenarios</h3>
      {manifest.demoScenarios.length === 0 ? (
        <p className="muted">No demo scenarios.</p>
      ) : (
        <ul>
          {manifest.demoScenarios.map((scenario) => (
            <li key={scenario.key} style={{ marginBottom: 8 }}>
              <a
                href={`/demos/${encodeURIComponent(
                  scenario.packKey,
                )}/${encodeURIComponent(scenario.key)}`}
              >
                {scenario.name}
              </a>{" "}
              <span className="badge neutral">{scenario.persona}</span>{" "}
              <span className="muted">~{scenario.estimatedMinutes} min</span>
              <div className="muted">{scenario.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryTab({
  installations,
}: {
  installations: DomainPackInstallation[];
}) {
  return (
    <div className="card">
      <h3>Installation history</h3>
      {installations.length === 0 ? (
        <p className="muted">No installation history.</p>
      ) : (
        <ul>
          {installations.map((install) => (
            <li key={install.id}>
              <strong>v{install.packVersion}</strong>{" "}
              <span className="badge neutral">{install.status}</span>{" "}
              <span className="muted">installed {install.installedAt}</span>
              {install.uninstalledAt ? (
                <span className="muted"> · uninstalled {install.uninstalledAt}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DomainPackDetail({ packKey }: { packKey: string }) {
  const { data, loading, error, refresh } = useDomainPackDetail(packKey);
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <>
      <PageHeader title="Domain Pack" sub={packKey} />

      <p style={{ marginTop: 8 }}>
        <a href="/domain-packs">← Back to catalog</a>
      </p>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="badge bad">Failed to load pack: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="row">
              <h2 style={{ margin: 0 }}>{data.entry.manifest.name}</h2>
              <InstalledPackBadge
                installed={data.entry.installed}
                version={data.entry.installedVersion}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <span className="badge neutral">{data.entry.objectCount} objects</span>
              <span className="badge neutral">{data.entry.workflowCount} workflows</span>
              <span className="badge neutral">{data.entry.demoCount} demos</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <InstallDomainPackButton entry={data.entry} onSettled={refresh} />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 16, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`btn${tab === t.key ? " active" : ""}`}
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {tab === "overview" ? <OverviewTab manifest={data.entry.manifest} /> : null}
            {tab === "objects" ? <ObjectsTab manifest={data.entry.manifest} /> : null}
            {tab === "workflows" ? <WorkflowsTab manifest={data.entry.manifest} /> : null}
            {tab === "evals" ? <EvalsTab manifest={data.entry.manifest} /> : null}
            {tab === "demos" ? <DemosTab manifest={data.entry.manifest} /> : null}
            {tab === "history" ? <HistoryTab installations={data.installations} /> : null}
          </div>
        </>
      ) : null}
    </>
  );
}
