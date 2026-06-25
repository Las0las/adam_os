// Phase 5 — Object properties panel (Part C-UI). Key/value rows of the object's
// raw properties; nested values are stringified.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { stringifyValue } from "./object-detail-format";

export function ObjectPropertiesPanel({ object }: { object: ObjectDetail["object"] }) {
  const entries = Object.entries(object.properties ?? {});
  if (entries.length === 0) {
    return <div className="muted">No properties recorded.</div>;
  }
  return (
    <div className="card">
      {entries.map(([key, value]) => (
        <div className="kv" key={key}>
          <span className="muted">{key}</span>
          <span>{stringifyValue(value)}</span>
        </div>
      ))}
    </div>
  );
}
