"use client";

// ProjectionSurface — applies surface chrome around the universal renderer. The
// SAME RenderPlan renders inside a modal, a drawer, or an inline page with zero
// changes to the form logic. This is the proof of surface-independence: the
// object definition and the resolved plan are identical; only the wrapper here
// differs, selected declaratively by `plan.surface` (or an explicit override).

import { useEffect } from "react";
import type { RenderPlan } from "@/lib/projection-runtime/contracts/universal-projection";
import { ProjectionRenderer } from "./ProjectionRenderer";

export function ProjectionSurface({
  plan,
  open = true,
  onClose,
  onSettled,
}: {
  plan: RenderPlan;
  open?: boolean;
  onClose?: () => void;
  onSettled?: () => void;
}) {
  const surface = plan.surface;

  // Escape closes overlay surfaces.
  useEffect(() => {
    if (!onClose || (surface !== "modal" && surface !== "drawer")) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, surface]);

  if (!open) return null;

  const header = (
    <header className="proj-header">
      <div>
        <h2 className="proj-title">{plan.title}</h2>
        {plan.description ? <p className="muted proj-desc">{plan.description}</p> : null}
      </div>
      {onClose && (surface === "modal" || surface === "drawer") ? (
        <button type="button" className="proj-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      ) : null}
    </header>
  );

  const body = (
    <>
      {header}
      <ProjectionRenderer plan={plan} onClose={onClose} onSettled={onSettled} />
    </>
  );

  if (surface === "modal") {
    return (
      <div className="proj-overlay" role="dialog" aria-modal="true" aria-label={plan.title}>
        <div className="proj-backdrop" onClick={onClose} />
        <div className="proj-modal" data-surface="modal">
          {body}
        </div>
      </div>
    );
  }

  if (surface === "drawer") {
    return (
      <div className="proj-overlay proj-overlay-right" role="dialog" aria-modal="true" aria-label={plan.title}>
        <div className="proj-backdrop" onClick={onClose} />
        <div className="proj-drawer" data-surface="drawer">
          {body}
        </div>
      </div>
    );
  }

  // fullPage (and any non-overlay surface) renders inline within the page card.
  return (
    <div className="card proj-page" data-surface={surface}>
      {body}
    </div>
  );
}
