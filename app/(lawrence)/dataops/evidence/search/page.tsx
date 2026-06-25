import { appContext } from "@/lib/app/demo-context";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function EvidenceSearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const ctx = await appContext();
  const query = searchParams.q;

  const result = query
    ? retrieve(ctx, {
        tenantId: ctx.tenantId,
        query,
        methods: ["rank_fusion"],
        limit: 10,
      })
    : null;

  return (
    <>
      <PageHeader
        title="Evidence Search"
        sub="Explainable retrieval across the evidence fabric."
      />

      <div className="card" style={{ marginTop: 16 }}>
        <form action="" method="get">
          <input
            type="text"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search evidence…"
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {result ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Results</h3>
          {result.hits.length === 0 ? (
            <p className="muted">No hits.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Object type</th>
                  <th>Score</th>
                  <th>Method</th>
                  <th>Excerpt</th>
                </tr>
              </thead>
              <tbody>
                {result.hits.map((h) => (
                  <tr key={`${h.chunkId}:${h.method}`}>
                    <td>
                      <code>{h.objectType}</code>
                    </td>
                    <td className="muted">{h.score.toFixed(3)}</td>
                    <td>
                      <code>{h.method}</code>
                    </td>
                    <td className="muted">{h.excerpt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </>
  );
}
