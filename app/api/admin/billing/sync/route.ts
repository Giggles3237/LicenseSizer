import { auth } from "@clerk/nextjs/server";
import { getStripe, hasProductAccess, syncStripeSubscription } from "../../../../../lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId || !session.orgId) return Response.json({ error: "Organization sign-in required." }, { status: 401 });
  const { sessionId } = await request.json() as { sessionId?: string };
  if (!sessionId) return Response.json({ error: "Checkout session is required." }, { status: 400 });

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.retrieve(sessionId);
  if (checkout.metadata?.organizationId !== session.orgId) return Response.json({ error: "Checkout session does not belong to this organization." }, { status: 403 });
  if (typeof checkout.subscription !== "string") return Response.json({ error: "No subscription was found for this checkout session." }, { status: 404 });

  const subscription = await syncStripeSubscription(await stripe.subscriptions.retrieve(checkout.subscription));
  return Response.json({ subscription, hasAccess: hasProductAccess(subscription?.status) });
}
