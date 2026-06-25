"use client";

// Phase 5 — Full-page object detail (Part H). Same content as the drawer but
// full-width with no overlay; used by the domain detail routes.

import { useObjectDetail } from "./useObjectDetail";
import { ObjectDetailContent } from "./ObjectDetailContent";

export function ObjectDetailFull({
  objectType,
  objectId,
}: {
  objectType: string;
  objectId: string;
}) {
  const { data, loading, error, refresh } = useObjectDetail(objectType, objectId);

  if (loading) {
    return <div className="muted" style={{ padding: 20 }}>Loading {objectType}…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16 }}>Unable to load {objectType}</h2>
        <div className="muted" style={{ fontSize: 12 }}>{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ maxWidth: 920 }}>
      <ObjectDetailContent detail={data} onRefresh={refresh} />
    </div>
  );
}
