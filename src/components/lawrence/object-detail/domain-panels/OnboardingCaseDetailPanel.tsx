// Phase 5 — Onboarding case domain panel (Part F). Summary of the new hire,
// checklist/step progress from properties, and linked objects.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString, stringifyValue } from "../object-detail-format";

export function OnboardingCaseDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const tasks = props.tasks ?? props.checklist ?? props.steps;
  const taskList = Array.isArray(tasks) ? tasks : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Onboarding</h3>
        <div className="kv"><span className="muted">Case</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "hireName") ? (
          <div className="kv"><span className="muted">New hire</span><span>{propString(props, "hireName")}</span></div>
        ) : null}
        {propString(props, "startDate") ? (
          <div className="kv"><span className="muted">Start date</span><span>{propString(props, "startDate")}</span></div>
        ) : null}
        {detail.object.status ? (
          <div className="kv"><span className="muted">Stage</span><span>{detail.object.status}</span></div>
        ) : null}
      </div>

      {taskList.length > 0 ? (
        <div className="card">
          <h3>Checklist</h3>
          {taskList.map((t, i) => (
            <div className="kv" key={i}>
              <span className="muted">Step {i + 1}</span>
              <span>{stringifyValue(t)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {detail.relationships.length > 0 ? (
        <div className="card">
          <h3>Linked</h3>
          {detail.relationships.map((r, i) => (
            <div className="row" key={`${r.objectId}:${i}`}>
              <span className="muted" style={{ fontSize: 12 }}>{r.linkType}</span>
              <Link href={`/objects/${encodeURIComponent(r.objectType)}/${encodeURIComponent(r.objectId)}`} style={{ fontSize: 12 }}>
                {r.objectType} · {r.title ?? r.objectId}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
