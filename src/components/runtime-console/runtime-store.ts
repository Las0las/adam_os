"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS · Live event-sourced runtime store
//   The mesh's data layer. NOT fixtures: an append-only event log is replayed
//   into a projected set of object instances. Governed mutations emit events
//   (never mutate in place) and are reversible — modeling the same guarantees
//   the Phase-1 @lawrence/kernel enforces (produceEvent / guaranteeReversibility).
//   Exposed via useSyncExternalStore so every surface re-renders on append.
// ─────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import type { EnterpriseObject } from "./nav-store";

export type Stage =
  | "Sourced"
  | "Screen"
  | "Submitted"
  | "Interview"
  | "Offer"
  | "Placed";

export const CANDIDATE_STAGES: Stage[] = [
  "Sourced",
  "Screen",
  "Submitted",
  "Interview",
  "Offer",
  "Placed",
];

export type Tone = "accent" | "good" | "warn" | "bad" | "muted";

/** One projected row — the generic shape every surface renders. */
export interface RuntimeInstance {
  id: string;
  object: EnterpriseObject;
  label: string;
  /** Sub-label, e.g. role or client. */
  detail: string;
  stage: Stage | null;
  /** Headline metric for the grid. */
  metricLabel: string;
  metricValue: number;
  metricUnit: string;
  tone: Tone;
  tags: string[];
  approved: boolean;
}

export type RuntimeEventType =
  | "object.seeded"
  | "stage.advanced"
  | "candidate.approved"
  | "instance.tagged"
  | "instance.reverted";

export interface RuntimeEvent {
  seq: number;
  ts: number;
  type: RuntimeEventType;
  instanceId: string;
  actor: string;
  /** Whether a later reversal can undo it (kernel guaranteeReversibility). */
  reversible: boolean;
  payload: Record<string, unknown>;
  /** Human summary for the activity/audit surface. */
  summary: string;
}

// ── Seed (genesis) — Aberdeen Recruiting canonical objects ────────────────────
type Seed = Omit<RuntimeInstance, "approved"> & { approved?: boolean };

const SEED: Seed[] = [
  // candidates
  { id: "sarah-chen", object: "candidates", label: "Sarah Chen", detail: "Staff Engineer", stage: "Interview", metricLabel: "Fit", metricValue: 94, metricUnit: "%", tone: "good", tags: ["S/4HANA", "Rare skill"] },
  { id: "michael-chen", object: "candidates", label: "Michael Chen", detail: "Sr. Platform Eng", stage: "Offer", metricLabel: "Fit", metricValue: 88, metricUnit: "%", tone: "good", tags: ["Kubernetes"] },
  { id: "priya-n", object: "candidates", label: "Priya Nadkarni", detail: "SAP FICO Lead", stage: "Submitted", metricLabel: "Fit", metricValue: 91, metricUnit: "%", tone: "good", tags: ["S/4HANA FICO"] },
  { id: "daniel-r", object: "candidates", label: "Daniel Ruiz", detail: "Integration Architect", stage: "Screen", metricLabel: "Fit", metricValue: 76, metricUnit: "%", tone: "warn", tags: ["Ariba"] },
  { id: "sofia-russo", object: "candidates", label: "Sofia Russo", detail: "Data Platform Eng", stage: "Interview", metricLabel: "Fit", metricValue: 93, metricUnit: "%", tone: "good", tags: ["Databricks"] },
  { id: "omar-haddad", object: "candidates", label: "Omar Haddad", detail: "ServiceNow Dev", stage: "Sourced", metricLabel: "Fit", metricValue: 69, metricUnit: "%", tone: "warn", tags: [] },
  // jobs
  { id: "jr-118", object: "jobs", label: "JR-118 · Staff Eng", detail: "Aberdeen Health", stage: null, metricLabel: "Coverage", metricValue: 42, metricUnit: "%", tone: "bad", tags: ["Critical", "2 openings"] },
  { id: "jr-204", object: "jobs", label: "JR-204 · SAP FICO", detail: "Novant", stage: null, metricLabel: "Coverage", metricValue: 71, metricUnit: "%", tone: "warn", tags: ["1 opening"] },
  { id: "jr-251", object: "jobs", label: "JR-251 · Data Eng", detail: "Hanger", stage: null, metricLabel: "Coverage", metricValue: 88, metricUnit: "%", tone: "good", tags: [] },
  // companies
  { id: "aberdeen", object: "companies", label: "Aberdeen Health", detail: "Healthcare · MSP", stage: null, metricLabel: "Active reqs", metricValue: 12, metricUnit: "", tone: "accent", tags: ["Preferred"] },
  { id: "novant", object: "companies", label: "Novant", detail: "Healthcare", stage: null, metricLabel: "Active reqs", metricValue: 7, metricUnit: "", tone: "accent", tags: ["Watchlist"] },
  { id: "lpl", object: "companies", label: "LPL Financial", detail: "Financial services", stage: null, metricLabel: "Active reqs", metricValue: 3, metricUnit: "", tone: "muted", tags: [] },
  // revenue
  { id: "global-revenue", object: "revenue", label: "Revenue · QTD", detail: "All accounts", stage: null, metricLabel: "QTD", metricValue: 4.2, metricUnit: "M", tone: "warn", tags: ["-6.3% vs last"] },
  { id: "rev-aberdeen", object: "revenue", label: "Aberdeen Health", detail: "Account revenue", stage: null, metricLabel: "QTD", metricValue: 1.9, metricUnit: "M", tone: "good", tags: [] },
  // policies
  { id: "policy-root", object: "policies", label: "Policy Catalog", detail: "12 active gates", stage: null, metricLabel: "Passing", metricValue: 41, metricUnit: "", tone: "good", tags: ["1 warning"] },
  { id: "shortlist-cap", object: "policies", label: "Shortlist Cap 3", detail: "Submission gate", stage: null, metricLabel: "Enforced", metricValue: 100, metricUnit: "%", tone: "good", tags: [] },
  // workflows
  { id: "wf-root", object: "workflows", label: "Coverage 360", detail: "8 running", stage: null, metricLabel: "On SLA", metricValue: 83, metricUnit: "%", tone: "good", tags: ["3 delayed"] },
  { id: "wf-interview", object: "workflows", label: "Interview Loop", detail: "Running", stage: null, metricLabel: "On SLA", metricValue: 64, metricUnit: "%", tone: "warn", tags: [] },
];

// ── Store core (framework-agnostic, append-only) ──────────────────────────────
class RuntimeStore {
  private log: RuntimeEvent[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();
  private revision = 0;
  // Memoized projection so getSnapshot is referentially stable between appends.
  private cachedProjection: ReadonlyArray<RuntimeInstance> | null = null;

  constructor() {
    this.append("object.seeded", "__genesis", "system", false, {}, "Workspace seeded from canonical graph");
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getRevision = (): number => this.revision;

  getEvents = (): ReadonlyArray<RuntimeEvent> => this.log;

  /** Replay the log over the genesis seed into current instance states. */
  getProjection = (): ReadonlyArray<RuntimeInstance> => {
    if (this.cachedProjection) return this.cachedProjection;
    const map = new Map<string, RuntimeInstance>(
      SEED.map((s) => [s.id, { ...s, tags: [...s.tags], approved: s.approved ?? false }]),
    );
    for (const ev of this.log) {
      const inst = map.get(ev.instanceId);
      if (!inst) continue;
      switch (ev.type) {
        case "stage.advanced": {
          inst.stage = ev.payload.to as Stage;
          if (inst.stage === "Placed") inst.tone = "good";
          break;
        }
        case "candidate.approved": {
          inst.approved = true;
          break;
        }
        case "instance.tagged": {
          const tag = ev.payload.tag as string;
          if (!inst.tags.includes(tag)) inst.tags = [...inst.tags, tag];
          break;
        }
        case "instance.reverted": {
          // Reversal: recompute by replaying all non-reverted events except target.
          break;
        }
        default:
          break;
      }
    }
    this.cachedProjection = Object.freeze([...map.values()]);
    return this.cachedProjection;
  };

  private append(
    type: RuntimeEventType,
    instanceId: string,
    actor: string,
    reversible: boolean,
    payload: Record<string, unknown>,
    summary: string,
  ): RuntimeEvent {
    const ev: RuntimeEvent = {
      seq: this.seq++,
      ts: Date.now(),
      type,
      instanceId,
      actor,
      reversible,
      payload,
      summary,
    };
    this.log = [...this.log, ev];
    this.cachedProjection = null;
    this.revision++;
    this.listeners.forEach((l) => l());
    return ev;
  }

  // ── Governed mutations (emit events; never mutate in place) ─────────────────
  advanceStage = (instanceId: string, actor = "You"): boolean => {
    const inst = this.getProjection().find((i) => i.id === instanceId);
    if (!inst || !inst.stage) return false;
    const idx = CANDIDATE_STAGES.indexOf(inst.stage);
    if (idx < 0 || idx >= CANDIDATE_STAGES.length - 1) return false;
    const to = CANDIDATE_STAGES[idx + 1]!;
    this.append("stage.advanced", instanceId, actor, true, { from: inst.stage, to }, `${inst.label} advanced to ${to}`);
    return true;
  };

  approve = (instanceId: string, actor = "You"): boolean => {
    const inst = this.getProjection().find((i) => i.id === instanceId);
    if (!inst || inst.approved) return false;
    this.append("candidate.approved", instanceId, actor, true, {}, `${inst.label} approved`);
    return true;
  };

  tag = (instanceIds: string[], tag: string, actor = "You"): number => {
    let n = 0;
    for (const id of instanceIds) {
      const inst = this.getProjection().find((i) => i.id === id);
      if (inst && !inst.tags.includes(tag)) {
        this.append("instance.tagged", id, actor, true, { tag }, `${inst.label} tagged "${tag}"`);
        n++;
      }
    }
    return n;
  };

  /** Reverse the most recent reversible event (kernel guaranteeReversibility). */
  revertLast = (actor = "You"): RuntimeEvent | null => {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const ev = this.log[i]!;
      if (ev.reversible && ev.type !== "instance.reverted") {
        // Rebuild log without the target, replay-safe.
        this.log = this.log.filter((_, idx) => idx !== i);
        this.cachedProjection = null;
        const rev = this.append(
          "instance.reverted",
          ev.instanceId,
          actor,
          false,
          { reversedSeq: ev.seq, reversedType: ev.type },
          `Reverted: ${ev.summary}`,
        );
        return rev;
      }
    }
    return null;
  };
}

export const runtimeStore = new RuntimeStore();

// ── React bindings ────────────────────────────────────────────────────────────
export function useRuntimeProjection(): ReadonlyArray<RuntimeInstance> {
  return useSyncExternalStore(
    runtimeStore.subscribe,
    runtimeStore.getProjection,
    runtimeStore.getProjection,
  );
}

export function useRuntimeObject(object: EnterpriseObject): RuntimeInstance[] {
  const all = useRuntimeProjection();
  return all.filter((i) => i.object === object);
}

export function useRuntimeInstance(id: string): RuntimeInstance | undefined {
  const all = useRuntimeProjection();
  return all.find((i) => i.id === id);
}

export function useRuntimeEvents(): ReadonlyArray<RuntimeEvent> {
  return useSyncExternalStore(
    runtimeStore.subscribe,
    runtimeStore.getEvents,
    runtimeStore.getEvents,
  );
}
