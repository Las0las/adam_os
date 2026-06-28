import type { Metadata } from "next";
import { LisWorkspace } from "@/components/runtime-console/lis-workspace";

export const metadata: Metadata = {
  title: "LAWRENCE · Consolidated Interaction Workspace",
  description:
    "LIS-001/002/003 composed: Canvas/Shelf shell framing the navigation mesh over live event-sourced runtime data with governed, reversible interactions.",
};

export default function Page() {
  return <LisWorkspace />;
}
