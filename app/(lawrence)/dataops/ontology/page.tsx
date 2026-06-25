import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OntologyPage() {
  const ctx = await appContext();
  const objects = await listObjects(ctx);
  const linkCount = (await db.ontologyLinks.list(ctx.tenantId)).length;

  // Group objects by objectType, preserving first-seen order.
  const groups = new Map<string, typeof objects>();
  for (const obj of objects) {
    const bucket = groups.get(obj.objectType) ?? [];
    bucket.push(obj);
    groups.set(obj.objectType, bucket);
  }

  return (
    <>
      <PageHeader
        title="Ontology"
        sub="The operating surface: typed objects and the links between them."
      />
      <div className="grid grid-3">
        <Metric label="Objects" value={objects.length} />
        <Metric label="Object types" value={groups.size} />
        <Metric label="Links" value={linkCount} />
      </div>

      {groups.size === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">No ontology objects.</p>
        </div>
      ) : (
        [...groups.entries()].map(([objectType, rows]) => (
          <div className="card" key={objectType} style={{ marginTop: 16 }}>
            <h3>
              <code>{objectType}</code> · {rows.length}
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Object type</th>
                  <th>Title</th>
                  <th>External key</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <code>{o.objectType}</code>
                    </td>
                    <td>{o.title ?? "—"}</td>
                    <td className="muted">{o.externalKey ?? "—"}</td>
                    <td>
                      <StatusBadge status={o.status ?? "neutral"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  );
}
