import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OntologyObjectsPage() {
  const ctx = await appContext();
  const objects = listObjects(ctx).slice(0, 200);

  return (
    <>
      <PageHeader
        title="Ontology Objects"
        sub="Typed objects across the ontology graph."
      />
      <div className="grid grid-3">
        <Metric label="Objects" value={objects.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Objects</h3>
        {objects.length === 0 ? (
          <p className="muted">No ontology objects.</p>
        ) : (
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
              {objects.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/dataops/ontology/objects/${o.objectType}`}>
                      <code>{o.objectType}</code>
                    </Link>
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
        )}
      </div>
    </>
  );
}
