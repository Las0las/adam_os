import type { Metadata } from "next";
import { CandidateStudio } from "@/components/lawrence/candidate-studio/CandidateStudio";

export const metadata: Metadata = {
  title: "Candidate Studio · LAWRENCE",
  description: "Resolve a canonical Candidate from inbound signal, governed by the registered Candidate object definition. An LDS-001 implementation.",
};

export default function CandidateStudioPage() {
  return <CandidateStudio />;
}
