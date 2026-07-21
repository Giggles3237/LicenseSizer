import { auth, currentUser } from "@clerk/nextjs/server";
import { CreateOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">Setup required</span><h1>Connect LicenseResizer</h1><p>Add the Clerk and Neon values from <code>.env.example</code>, then reload this page.</p><Link className="primary" href="/">Return to scanner</Link></section></main>;
  }
  await auth.protect();
  const session = await auth();
  if (!session.orgId) {
    return <main className="admin-shell"><section className="admin-empty"><span className="step-kicker">LicenseResizer for dealerships</span><h1>Create your organization</h1><p>Your organization keeps dealership settings, team access, and reporting separate from every other LicenseResizer customer.</p><CreateOrganization afterCreateOrganizationUrl="/dashboard" /></section></main>;
  }
  const user = await currentUser();
  const userLabel = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  return <main className="admin-shell">
    <header className="admin-topbar"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /></span><span>License<span>Resizer</span></span></Link><div className="admin-account"><span className="signed-in-as"><small>Signed in as</small><strong>{userLabel}</strong></span><OrganizationSwitcher afterSelectOrganizationUrl="/dashboard" /><UserButton /></div></header>
    <DashboardClient canManage={session.orgRole === "org:admin"} />
  </main>;
}
