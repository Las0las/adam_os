import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function ObjectDetailPage({
  params,
}: {
  params: { objectType: string; objectId: string };
}) {
  return <ObjectDetailFull objectType={params.objectType} objectId={params.objectId} />;
}
