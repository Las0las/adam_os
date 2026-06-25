import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { resolveFunction } from "@/lib/aiops/functions/function-registry";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function FunctionDetailPage({
  params,
}: {
  params: { functionId: string };
}) {
  await appContext();
  const fn = resolveFunction(params.functionId);

  if (!fn) {
    return (
      <>
        <PageHeader title="Function" />
        <Placeholder title="Function not found" note={`No function registered for "${params.functionId}".`} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={fn.name} sub={fn.description} />
      <div className="card">
        <h3>{fn.name}</h3>
        <p>
          <span className="badge neutral">{fn.klass}</span>
        </p>
        <p className="muted">{fn.description}</p>
        <h4>Output schema</h4>
        <pre>{JSON.stringify(fn.outputSchema, null, 2)}</pre>
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="./test">Test</Link>
          <Link href="./evals">Evals</Link>
        </div>
      </div>
    </>
  );
}
