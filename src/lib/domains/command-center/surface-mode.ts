// Phase 5 — recruiter vs executive surface modes (Part G). Mode shifts how the
// queues are prioritized so the same governed data serves two operator personas.

import type { CommandDomain, SurfaceMode } from "./command-center-types";

export const SURFACE_MODES: SurfaceMode[] = ["recruiter", "executive"];

export function isSurfaceMode(value: unknown): value is SurfaceMode {
  return value === "recruiter" || value === "executive";
}

/** Per-mode domain priority adjustments (added to the base ranking). */
export const MODE_DOMAIN_BONUS: Record<SurfaceMode, Partial<Record<CommandDomain, number>>> = {
  recruiter: {
    recruiting: 20,
    onboarding: 10,
    support: 0,
    claims: 0,
    executive: -5,
  },
  executive: {
    executive: 25,
    claims: 15,
    mission_control: 15,
    onboarding: 8,
    recruiting: 5,
  },
};
