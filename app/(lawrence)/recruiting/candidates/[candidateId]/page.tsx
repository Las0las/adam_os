import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function CandidateDetailPage({ params }: { params: { candidateId: string } }) {
  return <ObjectDetailFull objectType="Candidate" objectId={params.candidateId} />;
}
