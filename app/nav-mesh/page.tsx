import type { Metadata } from "next";
import { NavMesh } from "@/components/runtime-console/nav-mesh";

export const metadata: Metadata = {
  title: "LIS-003 · Navigation Mesh — LAWRENCE",
  description:
    "Three-layer navigation mesh: workspace rail, object surface tabs, and an omnibar pivot engine over one source of truth with non-destructive surface caching.",
};

export default function NavMeshPage() {
  return <NavMesh />;
}
