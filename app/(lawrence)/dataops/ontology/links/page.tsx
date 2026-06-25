import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OntologyLinksPage() {
  const ctx = await appContext();
  const links = db.ontologyLinks.list(ctx.tenantId);

  return (
    <>
      <PageHeader title="Ontology Links" sub="Typed relationships between objects." />
      <div className="grid grid-3">
        <Metric label="Total links" value={links.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Links</h3>
        {links.length === 0 ? (
          <p className="muted">No ontology links.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Link type</th>
                <th>From type</th>
                <th>To type</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>
                    <code>{l.linkType}</code>
                  </td>
                  <td>{l.fromObjectType}</td>
                  <td>{l.toObjectType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
