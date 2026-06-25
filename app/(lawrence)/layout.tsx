import { Sidebar } from "@/components/lawrence/shared/Sidebar";

export default function LawrenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
