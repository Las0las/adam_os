"use client";

import type { SurfaceMode } from "@/lib/domains/command-center/command-center-types";

const STORAGE_KEY = "lawrence.surfaceMode";

const MODES: { value: SurfaceMode; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "executive", label: "Executive" },
];

export function readStoredSurfaceMode(fallback: SurfaceMode = "executive"): SurfaceMode {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "recruiter" || stored === "executive" ? stored : fallback;
}

export function SurfaceModeToggle({
  mode,
  onChange,
}: {
  mode: SurfaceMode;
  onChange: (next: SurfaceMode) => void;
}) {
  const select = (next: SurfaceMode) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    onChange(next);
  };

  return (
    <div className="seg" role="group" aria-label="Surface mode">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={m.value === mode ? "active" : ""}
          onClick={() => select(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
