import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const ctx = await appContext();
  const chunks = await db.evidenceChunks.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Evidence"
        sub="Chunked, retrievable evidence grounding every AI answer back to source objects."
      />
      <div className="grid grid-3">
        <Metric label="Total chunks" value={chunks.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Chunks</h3>
        {chunks.length === 0 ? (
          <p className="muted">No evidence chunks.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Index</th>
                <th>Source object type</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              {chunks.map((c) => (
                <tr key={c.id}>
                  <td>{c.chunkIndex}</td>
                  <td>
                    <code>{c.sourceObjectType}</code>
                  </td>
                  <td className="muted">{c.text.slice(0, 120)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
