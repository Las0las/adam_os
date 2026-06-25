import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function NewFunctionPage() {
  await appContext();

  return (
    <>
      <PageHeader title="New Function" sub="Function Studio." />
      <Placeholder
        title="New Function"
        note="Function Studio editor (input/output schema, prompt, retrieval policy) lands later."
      />
    </>
  );
}
