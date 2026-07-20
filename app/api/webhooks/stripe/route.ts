import type Stripe from "stripe";
import { getStripe, saveBillingSubscription } from "../../../../lib/billing";

export const dynamic = "force-dynamic";

function periodEnd(subscription: Stripe.Subscription) {
  const unix = subscription.items.data[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!organizationId || !customerId) return;
  await saveBillingSubscription({
    organizationId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id ?? null,
    status: subscription.status,
    currentPeriodEnd: periodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new Response("Webhook signing is not configured.", { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return new Response("Invalid webhook signature.", { status: 400 }); }
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused" || event.type === "customer.subscription.resumed") {
    await syncSubscription(event.data.object);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (typeof session.subscription === "string") await syncSubscription(await getStripe().subscriptions.retrieve(session.subscription));
  }
  return Response.json({ received: true });
}
