import type Stripe from "stripe";
import { getStripe, syncStripeSubscription } from "../../../../lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new Response("Webhook signing is not configured.", { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return new Response("Invalid webhook signature.", { status: 400 }); }
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused" || event.type === "customer.subscription.resumed") {
    await syncStripeSubscription(event.data.object);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (typeof session.subscription === "string") await syncStripeSubscription(await getStripe().subscriptions.retrieve(session.subscription));
  }
  return Response.json({ received: true });
}
