"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS-003 · Three-Layer Navigation Mesh — single source of truth
// One Zustand store drives all three layers (rail · surface tabs · omnibar).
// Any layer mutates this; every layer re-renders from it. No layer owns state.
// ─────────────────────────────────────────────────────────────────────────

import { create } from "zustand";

export type EnterpriseObject =
  | "candidates"
  | "jobs"
  | "companies"
  | "revenue"
  | "policies"
  | "workflows";

/** Canonical lenses every object instance can be projected through. */
export type CanonicalSurface =
  | "overview"
  | "grid"
  | "document"
  | "canvas"
  | "composer"
  | "ai_studio"
  | "relationships"
  | "evidence"
  | "history";

export const ALL_SURFACES: CanonicalSurface[] = [
  "overview",
  "grid",
  "document",
  "canvas",
  "composer",
  "ai_studio",
  "relationships",
  "evidence",
  "history",
];

export interface NavigationState {
  activeObject: EnterpriseObject;
  /** Dynamic instance id, e.g. "sarah-chen". */
  activeId: string;
  activeLabel: string;
  activeSurface: CanonicalSurface;
  /** Last surface visited per instance id — restored on pivot (read-your-context). */
  surfaceHistory: Record<string, CanonicalSurface>;
  pinnedSurfaces: CanonicalSurface[];
  /** Instances ever visited — proves non-destructive surface caching. */
  mountedInstances: string[];
  /** Monotonic counter so consumers can prove a single-tick atomic pivot. */
  pivotTick: number;

  pivotTo: (
    object: EnterpriseObject,
    id: string,
    label: string,
    surface?: CanonicalSurface,
  ) => void;
  setSurface: (surface: CanonicalSurface) => void;
  togglePinSurface: (surface: CanonicalSurface) => void;
}

export const useNavStore = create<NavigationState>((set) => ({
  activeObject: "candidates",
  activeId: "sarah-chen",
  activeLabel: "Sarah Chen",
  activeSurface: "overview",
  surfaceHistory: { "sarah-chen": "overview" },
  pinnedSurfaces: ["overview", "grid", "document"],
  mountedInstances: ["sarah-chen"],
  pivotTick: 0,

  // Atomic context pivot: object + instance + surface change in ONE set().
  pivotTo: (object, id, label, surface) =>
    set((state) => {
      const targetSurface = surface ?? state.surfaceHistory[id] ?? "overview";
      return {
        activeObject: object,
        activeId: id,
        activeLabel: label,
        activeSurface: targetSurface,
        surfaceHistory: { ...state.surfaceHistory, [id]: targetSurface },
        mountedInstances: state.mountedInstances.includes(id)
          ? state.mountedInstances
          : [...state.mountedInstances, id],
        pivotTick: state.pivotTick + 1,
      };
    }),

  setSurface: (surface) =>
    set((state) => ({
      activeSurface: surface,
      surfaceHistory: { ...state.surfaceHistory, [state.activeId]: surface },
      pivotTick: state.pivotTick + 1,
    })),

  togglePinSurface: (surface) =>
    set((state) => ({
      pinnedSurfaces: state.pinnedSurfaces.includes(surface)
        ? state.pinnedSurfaces.filter((s) => s !== surface)
        : [...state.pinnedSurfaces, surface],
    })),
}));

// ── Static descriptors (labels / icons) — pure, no state ─────────────────────
import type { IconName } from "./icons";

export const OBJECTS: {
  id: EnterpriseObject;
  label: string;
  icon: IconName;
  rootId: string;
  rootLabel: string;
}[] = [
  { id: "candidates", label: "Candidates", icon: "candidate", rootId: "sarah-chen", rootLabel: "Sarah Chen" },
  { id: "jobs", label: "Jobs", icon: "job", rootId: "jr-118", rootLabel: "JR-118 · Staff Eng" },
  { id: "companies", label: "Companies", icon: "company", rootId: "aberdeen", rootLabel: "Aberdeen Health" },
  { id: "revenue", label: "Revenue", icon: "revenue", rootId: "global-revenue", rootLabel: "Revenue · QTD" },
  { id: "policies", label: "Policies", icon: "policy", rootId: "policy-root", rootLabel: "Policy Catalog" },
  { id: "workflows", label: "Workflows", icon: "workflow", rootId: "wf-root", rootLabel: "Coverage 360" },
];

export const SURFACE_META: Record<CanonicalSurface, { label: string; icon: IconName }> = {
  overview: { label: "Overview", icon: "objects" },
  grid: { label: "Grid", icon: "data" },
  document: { label: "Document", icon: "document" },
  canvas: { label: "Canvas", icon: "sparkle" },
  composer: { label: "Composer", icon: "send" },
  ai_studio: { label: "AI Studio", icon: "intent" },
  relationships: { label: "Relationships", icon: "objects" },
  evidence: { label: "Evidence", icon: "shield" },
  history: { label: "History", icon: "clock" },
};
