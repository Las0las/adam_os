import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function EvidenceChunkDetailPage({
  params,
}: {
  params: { chunkId: string };
}) {
  const ctx = await appContext();
  const chunk = await db.evidenceChunks.get(ctx.tenantId, params.chunkId);

  if (!chunk) {
    return (
      <>
        <PageHeader title="Evidence Chunk" />
        <Placeholder
          title="Chunk not found"
          note={`No evidence chunk with id ${params.chunkId}.`}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Evidence Chunk" sub={`Chunk #${chunk.chunkIndex}`} />

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Details</h3>
        <div className="row">
          <span>Source object type</span>
          <code>{chunk.sourceObjectType}</code>
        </div>
        <div className="row">
          <span>Source object ID</span>
          <code>{chunk.sourceObjectId}</code>
        </div>
        <div className="row">
          <span>Chunk index</span>
          <span className="muted">{chunk.chunkIndex}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Text</h3>
        <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
          {chunk.text}
        </pre>
      </div>
    </>
  );
}
