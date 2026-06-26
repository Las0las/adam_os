// Clerk requires a catch-all sign-in route as the redirect target for
// auth.protect(). Rendered only when Clerk is configured.
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="hero">
      <SignIn />
    </main>
  );
}
