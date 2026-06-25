"use client";

// Phase 5 — Object detail content (Part C-UI). Shared body used by both the
// drawer and the full-page detail view: header, tabs, and the active panel.
// Overview renders the matching domain panel when one exists, else the generic
// properties panel.

import { useState } from "react";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { ObjectPanelTabs, type ObjectDetailTab } from "./ObjectPanelTabs";
import { ObjectHeaderPanel } from "./ObjectHeaderPanel";
import { ObjectPropertiesPanel } from "./ObjectPropertiesPanel";
import { ObjectRelationshipPanel } from "./ObjectRelationshipPanel";
import { ObjectEvidencePanel } from "./ObjectEvidencePanel";
import { ObjectActionsPanel } from "./ObjectActionsPanel";
import { ObjectReviewPanel } from "./ObjectReviewPanel";
import { ObjectTracePanel } from "./ObjectTracePanel";
import { ObjectAuditTimeline } from "./ObjectAuditTimeline";
import { domainPanelFor } from "./domain-panels/registry";

export function ObjectDetailContent({
  detail,
  onRefresh,
}: {
  detail: ObjectDetail;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<ObjectDetailTab>("Overview");
  const DomainPanel = domainPanelFor(detail.object.objectType);

  return (
    <>
      <ObjectHeaderPanel object={detail.object} />
      <ObjectPanelTabs active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        DomainPanel ? <DomainPanel detail={detail} /> : <ObjectPropertiesPanel object={detail.object} />
      ) : null}
      {tab === "Evidence" ? <ObjectEvidencePanel evidence={detail.evidence} /> : null}
      {tab === "Relationships" ? <ObjectRelationshipPanel relationships={detail.relationships} /> : null}
      {tab === "Actions" ? (
        <ObjectActionsPanel
          actions={detail.actions}
          objectType={detail.object.objectType}
          objectId={detail.object.objectId}
          onRefresh={onRefresh}
        />
      ) : null}
      {tab === "Review" ? <ObjectReviewPanel reviews={detail.reviews} /> : null}
      {tab === "Traces" ? <ObjectTracePanel traces={detail.traces} /> : null}
      {tab === "Audit" ? <ObjectAuditTimeline audit={detail.audit} /> : null}
    </>
  );
}
