import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CanonicalDocumentsPage() {
  const ctx = await appContext();
  const documents = await db.canonicalDocuments.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Canonical Documents"
        sub="Normalized documents derived from raw assets."
      />
      <div className="grid grid-3">
        <Metric label="Total documents" value={documents.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Documents</h3>
        {documents.length === 0 ? (
          <p className="muted">No canonical documents.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Document type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/dataops/evidence/documents/${d.id}`}>
                      {d.title ?? "—"}
                    </Link>
                  </td>
                  <td>
                    <code>{d.documentType}</code>
                  </td>
                  <td className="muted">{d.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
