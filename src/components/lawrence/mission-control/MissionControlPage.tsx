"use client";

// Phase 6 — Mission Control client root. Loads the live governance + deployment
// control-plane overview, wires every action hook (releases, approvals,
// rollbacks, kill switches, runtime health), and lays out the metrics row plus
// three operating columns. Hosts the create/detail/rollback modals as
// controlled dialogs. Every mutation refetches via onSettled → refresh.

import { useState } from "react";
import { useMissionControlOverview } from "@/components/lawrence/hooks/useMissionControlOverview";
import { useReleaseActions } from "@/components/lawrence/hooks/useReleaseActions";
import { useApprovalActions } from "@/components/lawrence/hooks/useApprovalActions";
import { useKillSwitchActions } from "@/components/lawrence/hooks/useKillSwitchActions";
import { useRuntimeHealthActions } from "@/components/lawrence/hooks/useRuntimeHealthActions";
import { PageHeader, Metric } from "@/components/lawrence/shared/widgets";
import { EnvironmentStatusPanel } from "./EnvironmentStatusPanel";
import { ReleaseBundleTable } from "./ReleaseBundleTable";
import { ReleaseBundleDetailDrawer } from "./ReleaseBundleDetailDrawer";
import { CreateReleaseBundleDialog } from "./CreateReleaseBundleDialog";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";
import { RollbackDialog } from "./RollbackDialog";
import { KillSwitchPanel } from "./KillSwitchPanel";
import { RuntimeComponentTable } from "./RuntimeComponentTable";
import { RuntimeHealthPanel } from "./RuntimeHealthPanel";
import { RuntimeIncidentPanel } from "./RuntimeIncidentPanel";
import { MissionAuditTimeline } from "./MissionAuditTimeline";

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 72 }} />
    </div>
  );
}

export function MissionControlPage() {
  const { data, loading, error, refresh } = useMissionControlOverview();

  const releaseActions = useReleaseActions(refresh);
  const approvalActions = useApprovalActions(refresh);
  const killSwitchActions = useKillSwitchActions(refresh);
  const healthActions = useRuntimeHealthActions(refresh);

  const [environmentKey, setEnvironmentKey] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailReleaseId, setDetailReleaseId] = useState<string | null>(null);
  const [rollbackReleaseId, setRollbackReleaseId] = useState<string | null>(null);

  const environments = data?.environments ?? [];
  const metrics = data?.metrics;

  const mutationPending =
    releaseActions.pending ||
    approvalActions.pending ||
    killSwitchActions.pending ||
    healthActions.pending;

  return (
    <>
      <PageHeader
        title="Mission Control"
        sub="Govern releases, approvals, runtime health, rollbacks, and kill switches."
      />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="btn-row">
          <label className="kv">
            <span className="muted">Environment</span>
            <select
              value={environmentKey}
              onChange={(e) => setEnvironmentKey(e.target.value)}
            >
              <option value="">All environments</option>
              {environments.map((env) => (
                <option key={env.id} value={env.key}>
                  {env.name} ({env.key})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={refresh}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setShowCreate(true)}
          >
            New release
          </button>
        </div>
      </div>

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load Mission Control: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {metrics ? (
        <div className="cc-grid" style={{ marginTop: 16 }}>
          <Metric label="Pending Approvals" value={metrics.pendingApprovals} />
          <Metric label="Promoted Releases 24h" value={metrics.promotedReleases24h} />
          <Metric label="Failed Releases 7d" value={metrics.failedReleases7d} />
          <Metric label="Active Kill Switches" value={metrics.activeKillSwitches} />
          <Metric label="Degraded Components" value={metrics.degradedComponents} />
          <Metric label="Failed Components" value={metrics.failedComponents} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="cc-grid" style={{ marginTop: 16 }}>
          <div className="cc-col">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="cc-col">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="cc-col">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <CreateReleaseBundleDialog
          environments={environments}
          pending={releaseActions.pending}
          onCreate={releaseActions.createRelease}
          onClose={() => setShowCreate(false)}
        />
      ) : null}

      {detailReleaseId ? (
        <ReleaseBundleDetailDrawer
          releaseId={detailReleaseId}
          onClose={() => setDetailReleaseId(null)}
        />
      ) : null}

      {rollbackReleaseId ? (
        <RollbackDialog
          releaseId={rollbackReleaseId}
          pending={releaseActions.pending}
          onSubmit={releaseActions.requestRollback}
          onClose={() => setRollbackReleaseId(null)}
        />
      ) : null}

      {data ? (
        <div className="cc-grid" style={{ marginTop: 16 }}>
          <div className="cc-col">
            <EnvironmentStatusPanel environments={environments} />
            <ReleaseBundleTable
              releases={data.releases}
              environments={environments}
              pending={releaseActions.pending}
              onSubmit={releaseActions.submit}
              onPromote={releaseActions.promote}
              onRollback={(id) => setRollbackReleaseId(id)}
              onView={(id) => setDetailReleaseId(id)}
            />
            <RuntimeComponentTable components={data.runtimeComponents} />
          </div>

          <div className="cc-col">
            <ApprovalQueuePanel
              approvals={data.pendingApprovals}
              pending={approvalActions.pending}
              onApprove={approvalActions.approve}
              onReject={approvalActions.reject}
            />
            <RuntimeHealthPanel
              healthChecks={data.recentHealthChecks}
              pending={healthActions.pending}
              onRun={() => {
                void healthActions.runHealthChecks();
              }}
            />
          </div>

          <div className="cc-col">
            <KillSwitchPanel
              killSwitches={data.activeKillSwitches}
              environments={environments}
              pending={killSwitchActions.pending}
              onEnable={(input) => {
                void killSwitchActions.enable(input);
              }}
              onDisable={(input) => {
                void killSwitchActions.disable(input);
              }}
            />
            <RuntimeIncidentPanel incidents={data.runtimeIncidents} />
            <MissionAuditTimeline
              healthChecks={data.recentHealthChecks}
              incidents={data.runtimeIncidents}
              killSwitches={data.activeKillSwitches}
            />
          </div>
        </div>
      ) : null}

      {mutationPending ? (
        <div className="card">
          <p className="muted">Working…</p>
        </div>
      ) : null}
    </>
  );
}
