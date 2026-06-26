// Clerk requires a catch-all sign-up route. Rendered only when Clerk is
// configured.
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="hero">
      <SignUp />
    </main>
  );
}
