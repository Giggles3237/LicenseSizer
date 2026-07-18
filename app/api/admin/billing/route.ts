import { auth } from "@clerk/nextjs/server";
import { getBillingSubscription, hasProductAccess } from "../../../../lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session.userId || !session.orgId) return Response.json({ error: "Organization sign-in required." }, { status: 401 });
  const subscription = await getBillingSubscription(session.orgId);
  return Response.json({
    configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
    subscription,
    hasAccess: hasProductAccess(subscription?.status),
  });
}
