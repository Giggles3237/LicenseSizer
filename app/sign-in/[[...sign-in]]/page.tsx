import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">Setup required</span><h1>Connect LicenseResizer</h1><p>Add the Clerk values from <code>.env.example</code>, then reload this page.</p><Link className="primary" href="/">Return to scanner</Link></section></main>;
  }
  return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">LicenseResizer for dealerships</span><h1>Sign in to your dealer console</h1><SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" /></section></main>;
}
