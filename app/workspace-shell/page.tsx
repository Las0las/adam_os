import type { Metadata } from "next";
import { WorkspaceShellDemo } from "@/components/runtime-console/WorkspaceShellDemo";

export const metadata: Metadata = {
  title: "LIS-002 · Canvas vs. Shelf · LAWRENCE",
  description:
    "IDE-grade workspace shell: the Canvas owns the viewport, the Shelf collapses to a 40px icon baseline and expands as overlay or flex.",
};

export default function WorkspaceShellPage() {
  return <WorkspaceShellDemo />;
}
