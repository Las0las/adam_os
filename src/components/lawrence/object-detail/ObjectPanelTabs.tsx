"use client";

// Phase 5 — Object detail tab bar (Part C-UI). Controlled tab selector for the
// detail panels.

export const OBJECT_DETAIL_TABS = [
  "Overview",
  "Evidence",
  "Relationships",
  "Actions",
  "Review",
  "Traces",
  "Audit",
] as const;

export type ObjectDetailTab = (typeof OBJECT_DETAIL_TABS)[number];

export function ObjectPanelTabs({
  active,
  onChange,
}: {
  active: ObjectDetailTab;
  onChange: (tab: ObjectDetailTab) => void;
}) {
  return (
    <div className="tabs">
      {OBJECT_DETAIL_TABS.map((tab) => (
        <button
          key={tab}
          className={`tab${tab === active ? " active" : ""}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
