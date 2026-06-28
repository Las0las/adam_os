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
      <head>
        {/* Poppins is the Aberdeen brand font (LDS-001). Loaded client-side via
            <link> rather than next/font so the build never blocks on font
            egress; Arial is the brand-sanctioned fallback if it can't load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
  // Only mount the Clerk provider when configured; without keys the platform
  // runs unauthenticated (dev/demo) and the build needs no Clerk credentials.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return shell;
  return <ClerkProvider>{shell}</ClerkProvider>;
}
