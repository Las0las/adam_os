import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function FunctionTestPage({
  params,
}: {
  params: { functionId: string };
}) {
  await appContext();

  return (
    <>
      <PageHeader title={`Test ${params.functionId}`} />
      <Placeholder
        title={`Test ${params.functionId}`}
        note="Interactive test runner posts to /api/aiops/functions/:key/run."
      />
    </>
  );
}
