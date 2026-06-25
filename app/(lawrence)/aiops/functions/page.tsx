import { appContext } from "@/lib/app/demo-context";
import { listFunctions } from "@/lib/aiops/functions/function-registry";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function FunctionsPage() {
  await appContext();
  const fns = listFunctions();

  return (
    <>
      <PageHeader
        title="Functions"
        sub="The registry of governed, typed AI functions available to the platform."
      />
      <div className="grid grid-3">
        <Metric label="Functions" value={fns.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Function registry</h3>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Class</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {fns.map((f) => (
              <tr key={f.key}>
                <td>
                  <code>{f.key}</code>
                </td>
                <td>
                  <span className="badge neutral">{f.klass}</span>
                </td>
                <td className="muted">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
