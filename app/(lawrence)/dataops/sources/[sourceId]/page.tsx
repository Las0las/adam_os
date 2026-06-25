import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: { sourceId: string };
}) {
  const ctx = await appContext();
  const source = db.sources.get(ctx.tenantId, params.sourceId);

  if (!source) {
    return (
      <>
        <PageHeader title="Source" />
        <Placeholder title="Source not found" note={`No source with id ${params.sourceId}.`} />
      </>
    );
  }

  const assets = db.rawAssets.list(ctx.tenantId, (a) => a.sourceId === params.sourceId);

  return (
    <>
      <PageHeader title={source.name} sub={`Source · ${source.kind}`} />
      <div className="grid grid-3">
        <Metric label="Raw assets" value={assets.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Details</h3>
        <div className="row">
          <span>ID</span>
          <code>{source.id}</code>
        </div>
        <div className="row">
          <span>Name</span>
          <span>{source.name}</span>
        </div>
        <div className="row">
          <span>Kind</span>
          <code>{source.kind}</code>
        </div>
        <div className="row">
          <span>Created</span>
          <span className="muted">{source.createdAt.slice(0, 10)}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Raw assets</h3>
        {assets.length === 0 ? (
          <p className="muted">No raw assets for this source.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File name</th>
                <th>Kind</th>
                <th>Size (bytes)</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td>{a.fileName}</td>
                  <td>
                    <code>{a.kind}</code>
                  </td>
                  <td className="muted">{a.sizeBytes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
