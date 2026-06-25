import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CanonicalDocumentDetailPage({
  params,
}: {
  params: { documentId: string };
}) {
  const ctx = await appContext();
  const document = await db.canonicalDocuments.get(ctx.tenantId, params.documentId);

  if (!document) {
    return (
      <>
        <PageHeader title="Document" />
        <Placeholder
          title="Document not found"
          note={`No canonical document with id ${params.documentId}.`}
        />
      </>
    );
  }

  const records = await db.canonicalRecords.list(
    ctx.tenantId,
    (r) => r.documentId === params.documentId,
  );

  return (
    <>
      <PageHeader
        title={document.title ?? "Document"}
        sub={`Canonical document · ${document.documentType}`}
      />

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Text content</h3>
        {document.textContent ? (
          <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {document.textContent.slice(0, 1000)}
          </pre>
        ) : (
          <p className="muted">No text content.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Records</h3>
        {records.length === 0 ? (
          <p className="muted">No canonical records.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Record type</th>
                <th>Source path</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.recordType}</code>
                  </td>
                  <td className="muted">{r.sourcePath ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
