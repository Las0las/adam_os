import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const ctx = await appContext();
  const docs = listObjects(ctx, "KnowledgeDocument");

  return (
    <>
      <PageHeader title="Knowledge" sub="KnowledgeDocument objects projected from ingested data." />
      <Metric label="Documents" value={docs.length} />
      <div className="card">
        <h3>Documents</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.title ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
