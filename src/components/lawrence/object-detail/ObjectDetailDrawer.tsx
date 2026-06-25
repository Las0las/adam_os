"use client";

// Phase 5 — Object detail drawer (Part C-UI / H). Slide-over view of a single
// object: header, tabs, and the active panel. Overview shows the matching domain
// panel when one exists.

import { useObjectDetail } from "./useObjectDetail";
import { ObjectDetailContent } from "./ObjectDetailContent";

export function ObjectDetailDrawer({
  objectType,
  objectId,
  onClose,
}: {
  objectType: string;
  objectId: string;
  onClose: () => void;
}) {
  const { data, loading, error, refresh } = useObjectDetail(objectType, objectId);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading ? (
          <div className="muted" style={{ marginTop: 40 }}>Loading {objectType}…</div>
        ) : error ? (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16 }}>Unable to load</h2>
            <div className="muted" style={{ fontSize: 12 }}>{error}</div>
          </div>
        ) : data ? (
          <ObjectDetailContent detail={data} onRefresh={refresh} />
        ) : null}
      </div>
    </>
  );
}
