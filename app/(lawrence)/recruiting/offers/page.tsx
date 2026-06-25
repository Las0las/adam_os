import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  await appContext();

  return (
    <>
      <PageHeader title="Offers" sub="Offer generation and approvals." />
      <Placeholder title="Offers" note="Scaffolded surface — wiring lands in a later pass." />
    </>
  );
}
