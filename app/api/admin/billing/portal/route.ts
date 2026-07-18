import { auth } from "@clerk/nextjs/server";
import { getBillingSubscription, getStripe } from "../../../../../lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId || !session.orgId) return Response.json({ error: "Organization sign-in required." }, { status: 401 });
  if (session.orgRole !== "org:admin") return Response.json({ error: "Organization admin access is required." }, { status: 403 });
  const subscription = await getBillingSubscription(session.orgId);
  if (!subscription) return Response.json({ error: "No billing account was found." }, { status: 404 });
  const portal = await getStripe().billingPortal.sessions.create({ customer: subscription.stripeCustomerId, return_url: `${new URL(request.url).origin}/dashboard` });
  return Response.json({ url: portal.url });
}
