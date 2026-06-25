import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { listTransforms } from "@/lib/dataops/transforms/transform-registry";
import { listParsers } from "@/lib/dataops/parsers/parser-registry";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function DataOpsPage() {
  const ctx = await appContext();
  const objects = await listObjects(ctx);
  const byType = objects.reduce<Record<string, number>>((acc, o) => {
    acc[o.objectType] = (acc[o.objectType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="DataOps"
        sub="Canonical pipeline engine, ontology object graph, and evidence fabric."
      />
      <div className="grid grid-4">
        <Metric label="Sources" value={(await db.sources.list(ctx.tenantId)).length} />
        <Metric label="Raw assets" value={(await db.rawAssets.list(ctx.tenantId)).length} />
        <Metric label="Ontology objects" value={objects.length} />
        <Metric label="Evidence chunks" value={(await db.evidenceChunks.list(ctx.tenantId)).length} />
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Objects by type</h3>
          {Object.entries(byType).map(([type, count]) => (
            <div className="row" key={type}>
              <span>{type}</span>
              <span className="muted">{count}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Registered parsers</h3>
          {listParsers().map((p) => (
            <div className="row" key={p.key}>
              <code>{p.key}</code>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Transform registry</h3>
          {listTransforms().map((t) => (
            <div className="row" key={t.key}>
              <span>{t.label}</span>
              <code>{t.key}</code>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
