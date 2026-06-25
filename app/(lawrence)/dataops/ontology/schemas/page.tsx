import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OntologySchemasPage() {
  const ctx = await appContext();
  const objects = await listObjects(ctx);

  const types = new Set<string>();
  for (const o of objects) types.add(o.objectType);

  const counts = [...types].map((type) => ({
    type,
    count: objects.filter((o) => o.objectType === type).length,
  }));

  return (
    <>
      <PageHeader
        title="Object Type Registry"
        sub="Distinct ontology object types and their populations."
      />
      <div className="grid grid-3">
        <Metric label="Object types" value={types.size} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Object Type Registry</h3>
        {counts.length === 0 ? (
          <p className="muted">No object types.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Object type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.type}>
                  <td>
                    <code>{c.type}</code>
                  </td>
                  <td className="muted">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
