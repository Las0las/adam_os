import { EprExplorer } from "@/components/lawrence/epr/EprExplorer";

export const metadata = {
  title: "EPR-001 · Enterprise Property Runtime",
  description: "One runtime, any Enterprise Object — Job and Candidate are projections of a schema.",
};

export default function EprPage() {
  return <EprExplorer />;
}
