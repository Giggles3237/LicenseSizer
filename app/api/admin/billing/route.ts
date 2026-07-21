import { auth } from "@clerk/nextjs/server";
import { getBillingSubscription, hasProductAccess } from "../../../../lib/billing";
import { getMonthlyPdfUsage } from "../../../../lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session.userId || !session.orgId) return Response.json({ error: "Organization sign-in required." }, { status: 401 });
  const subscription = await getBillingSubscription(session.orgId);
  const usage = await getMonthlyPdfUsage(session.orgId);
  const hasAnyPrice = Boolean(process.env.STRIPE_PRICE_ID || process.env.STRIPE_DEALER_PRICE_ID || process.env.STRIPE_INDIVIDUAL_PRICE_ID);
  return Response.json({
    configured: Boolean(process.env.STRIPE_SECRET_KEY && hasAnyPrice),
    subscription,
    usage,
    hasAccess: hasProductAccess(subscription?.status),
  });
}
