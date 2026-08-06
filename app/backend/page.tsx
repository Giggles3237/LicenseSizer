import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import LicenseResizerBrand from "../brand-logo";
import { emailDeliveryConfigured } from "../../lib/email";
import { isPlatformAdmin } from "../../lib/platform-admin";
import { getPlatformOverview } from "../../lib/platform-data";
import BackendClient from "./backend-client";

export const dynamic = "force-dynamic";

function siteOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
  if (!raw) return "";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
}

export default async function BackendPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">Setup required</span><h1>Connect LicenseResizer</h1><p>Add Clerk values from <code>.env.example</code>, then reload this page.</p><Link className="primary" href="/">Return to scanner</Link></section></main>;
  }
  await auth.protect();
  const user = await currentUser();
  if (!isPlatformAdmin(user)) {
    return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">Product backend</span><h1>Access restricted</h1><p>Add your Clerk email to <code>PLATFORM_ADMIN_EMAILS</code> to use the LicenseResizer backend.</p><Link className="primary" href="/dashboard">Open dealer dashboard</Link></section></main>;
  }

  const overview = await getPlatformOverview();
  const origin = siteOrigin();
  const userLabel = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";

  return <main className="admin-shell">
    <header className="admin-topbar"><LicenseResizerBrand /><div className="admin-account"><Link className="text-button" href="/dashboard">Dealer dashboard</Link><span className="signed-in-as"><small>Backend user</small><strong>{userLabel}</strong></span><SignOutButton redirectUrl="/"><button className="text-button account-sign-out" type="button">Log out</button></SignOutButton><UserButton /></div></header>
    <section className="platform-shell">
      <div className="admin-heading"><div><span className="step-kicker">LicenseResizer backend</span><h1>Product pulse</h1><p>Watch dealer signups, trials, usage, and follow-up from one internal console.</p></div></div>
      <div className="metric-grid">
        <div><strong>{overview.summary.organizations}</strong><span>Dealer workspaces</span></div>
        <div><strong>{overview.summary.contacts}</strong><span>Follow-up contacts</span></div>
        <div><strong>{overview.summary.trialing}</strong><span>Trials</span></div>
        <div><strong>{overview.summary.pdfs30}</strong><span>PDFs in 30 days</span></div>
      </div>
      <BackendClient leads={overview.leads} siteOrigin={origin || ""} emailConfigured={emailDeliveryConfigured()} />
    </section>
  </main>;
}
