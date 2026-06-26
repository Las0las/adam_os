import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAWRENCE — Enterprise Operating System",
  description:
    "A governed enterprise operating system: DataOps, AIOps, and Mission Control over a canonical object graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  // Only mount the Clerk provider when configured; without keys the platform
  // runs unauthenticated (dev/demo) and the build needs no Clerk credentials.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return shell;
  return <ClerkProvider>{shell}</ClerkProvider>;
}
