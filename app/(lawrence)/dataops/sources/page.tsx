import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const ctx = await appContext();
  const sources = db.sources.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Sources"
        sub="Connected data origins feeding the ingestion plane."
      />
      <div className="grid grid-3">
        <Metric label="Total sources" value={sources.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Sources</h3>
        {sources.length === 0 ? (
          <p className="muted">No sources.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/dataops/sources/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>
                    <code>{s.kind}</code>
                  </td>
                  <td className="muted">{s.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
