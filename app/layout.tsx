import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAWRENCE — Enterprise Operating System",
  description:
    "A governed enterprise operating system: DataOps, AIOps, and Mission Control over a canonical object graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
