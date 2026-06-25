import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function ValidationCaseDetailPage({ params }: { params: { caseId: string } }) {
  return <ObjectDetailFull objectType="ValidationCase" objectId={params.caseId} />;
}
