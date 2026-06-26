// Edge auth boundary. When Clerk is configured, every route except the public
// set requires an authenticated session (fail-closed via auth.protect()). When
// Clerk is NOT configured (local/dev/demo without keys), the middleware is a
// pass-through so the platform stays runnable — appContext() then applies the
// demo fallback. Tenant resolution and RBAC enforcement happen server-side in
// the service layer; this boundary only establishes authentication.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

// Public routes: marketing, the health probe, and inbound webhooks (which
// authenticate by signature, not a user session), plus Clerk's own auth pages.
const isPublicRoute = createRouteMatcher([
  "/welcome",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/api/integrations/webhooks(.*)",
]);

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

const protectedMiddleware = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!clerkConfigured) return NextResponse.next();
  return protectedMiddleware(req, ev);
}

export const config = {
  // Run on everything except Next internals and static files; always on API.
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
