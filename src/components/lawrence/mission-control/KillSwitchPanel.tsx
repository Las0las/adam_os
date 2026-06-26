"use client";

// Phase 6 — Kill switch panel. Lists active kill switches with a Disable action
// and provides an "Enable kill switch" sub-form. Enable is blocked until the
// reason is non-empty.

import { useState } from "react";
import type {
  Environment,
  KillSwitch,
  RuntimeComponentType,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type {
  EnableKillSwitchInput,
  DisableKillSwitchInput,
} from "@/components/lawrence/hooks/useKillSwitchActions";
import { timeAgo } from "./missionControlFormat";

const COMPONENT_TYPES: RuntimeComponentType[] = [
  "pipeline",
  "function",
  "agent",
  "action",
  "notification_rule",
  "model",
  "integration",
];

export function KillSwitchPanel({
  killSwitches,
  environments,
  pending,
  onEnable,
  onDisable,
}: {
  killSwitches: KillSwitch[];
  environments: Environment[];
  pending: boolean;
  onEnable: (input: EnableKillSwitchInput) => void;
  onDisable: (input: DisableKillSwitchInput) => void;
}) {
  const [componentType, setComponentType] =
    useState<RuntimeComponentType>("function");
  const [componentKey, setComponentKey] = useState("");
  const [environmentKey, setEnvironmentKey] = useState("");
  const [reason, setReason] = useState("");

  const canEnable =
    reason.trim().length > 0 && componentKey.trim().length > 0 && !pending;

  const envKey = (id: string | null | undefined): string => {
    if (!id) return "—";
    const env = environments.find((e) => e.id === id);
    return env ? env.key : id;
  };

  const handleEnable = () => {
    if (!canEnable) return;
    onEnable({
      componentType,
      componentKey: componentKey.trim(),
      environmentKey: environmentKey.trim() || undefined,
      reason: reason.trim(),
    });
    setComponentKey("");
    setReason("");
  };

  return (
    <div className="card">
      <h3>Kill switches</h3>
      {killSwitches.length === 0 ? (
        <p className="muted">No active kill switches.</p>
      ) : (
        killSwitches.map((ks) => (
          <div className="card" key={ks.id}>
            <div className="kv">
              <span className="muted">Component</span>
              <span>
                {ks.componentType}:{ks.componentKey}
              </span>
            </div>
            {ks.environmentId ? (
              <div className="kv">
                <span className="muted">Environment</span>
                <span>{envKey(ks.environmentId)}</span>
              </div>
            ) : null}
            {ks.reason ? (
              <div className="kv">
                <span className="muted">Reason</span>
                <span>{ks.reason}</span>
              </div>
            ) : null}
            <div className="kv">
              <span className="muted">Enabled</span>
              <span>{timeAgo(ks.enabledAt)}</span>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() =>
                  onDisable({
                    componentType: ks.componentType,
                    componentKey: ks.componentKey,
                    environmentKey: ks.environmentId
                      ? envKey(ks.environmentId)
                      : undefined,
                  })
                }
              >
                Disable
              </button>
            </div>
          </div>
        ))
      )}

      <h4>Enable kill switch</h4>
      <label className="kv">
        <span className="muted">Component type</span>
        <select
          value={componentType}
          onChange={(e) =>
            setComponentType(e.target.value as RuntimeComponentType)
          }
        >
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="kv">
        <span className="muted">Component key</span>
        <input
          type="text"
          value={componentKey}
          onChange={(e) => setComponentKey(e.target.value)}
        />
      </label>
      <label className="kv">
        <span className="muted">Environment</span>
        <select
          value={environmentKey}
          onChange={(e) => setEnvironmentKey(e.target.value)}
        >
          <option value="">All</option>
          {environments.map((env) => (
            <option key={env.id} value={env.key}>
              {env.name} ({env.key})
            </option>
          ))}
        </select>
      </label>
      <label className="kv">
        <span className="muted">Reason</span>
        <textarea
          value={reason}
          placeholder="Why enable this kill switch?"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={!canEnable}
          onClick={handleEnable}
        >
          Enable
        </button>
      </div>
    </div>
  );
}
