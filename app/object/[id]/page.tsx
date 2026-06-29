import type { Metadata } from "next";
import { ObjectDetail } from "@/components/runtime-console/object-detail";

export const metadata: Metadata = {
  title: "LAWRENCE · People Object",
  description:
    "Enterprise Object Runtime — People object-detail surface over live event-sourced runtime data with governed, reversible actions.",
};

export default function Page({ params }: { params: { id: string } }) {
  return <ObjectDetail initialId={params.id} />;
}
