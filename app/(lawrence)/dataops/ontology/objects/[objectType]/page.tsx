import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OntologyObjectTypePage({
  params,
}: {
  params: { objectType: string };
}) {
  const ctx = await appContext();
  const objects = listObjects(ctx, params.objectType);

  return (
    <>
      <PageHeader title={params.objectType} sub="Objects of this type." />
      <div className="grid grid-3">
        <Metric label="Objects" value={objects.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Objects</h3>
        {objects.length === 0 ? (
          <p className="muted">No objects of this type.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>External key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {objects.map((o) => (
                <tr key={o.id}>
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
