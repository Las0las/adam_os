import { DomainPackDetail } from "@/components/lawrence/domain-packs/DomainPackDetail";

export const dynamic = "force-dynamic";

export default function DomainPackDetailPage({
  params,
}: {
  params: { packKey: string };
}) {
  return <DomainPackDetail packKey={params.packKey} />;
}
