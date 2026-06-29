import type { Metadata } from "next";
import { ObjectDetail } from "@/components/runtime-console/object-detail";

export const metadata: Metadata = {
  title: "LAWRENCE · People Object — Sarah Chen",
  description:
    "Enterprise Object Runtime — People object-detail surface. Full command-bar / index / context chrome over live event-sourced runtime data with governed, reversible actions.",
};

export default function Page() {
  return <ObjectDetail initialId="sarah-chen" />;
}
