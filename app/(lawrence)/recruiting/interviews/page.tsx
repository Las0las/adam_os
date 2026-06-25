import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  await appContext();

  return (
    <>
      <PageHeader title="Interviews" sub="Interview scheduling and feedback." />
      <Placeholder title="Interviews" note="Scaffolded surface — wiring lands in a later pass." />
    </>
  );
}
