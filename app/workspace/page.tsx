import { UniversalWorkspaceShell } from "@/components/lawrence/workspace/UniversalWorkspaceShell";

export const metadata = {
  title: "Universal Workspace · LAWRENCE",
  description: "The persistent LDS-001 workspace shell that hosts every studio as an object projection.",
};

export default function WorkspacePage() {
  return <UniversalWorkspaceShell />;
}
