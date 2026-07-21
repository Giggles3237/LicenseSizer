import "server-only";

import type Stripe from "stripe";
import StripeClient from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { billingSubscriptions } from "../db/schema";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new StripeClient(key);
}

export async function getBillingSubscription(organizationId: string) {
  const [subscription] = await getDb().select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, organizationId)).limit(1);
  return subscription ?? null;
}

export async function saveBillingSubscription(values: typeof billingSubscriptions.$inferInsert) {
  const [subscription] = await getDb().insert(billingSubscriptions).values(values).onConflictDoUpdate({
    target: billingSubscriptions.organizationId,
    set: { ...values, updatedAt: new Date() },
  }).returning();
  return subscription;
}

export function hasProductAccess(status?: string | null) {
  return status === "active" || status === "trialing";
}

function periodEnd(subscription: Stripe.Subscription) {
  const unix = subscription.items.data[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : null;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!organizationId || !customerId) return null;
  return saveBillingSubscription({
    organizationId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id ?? null,
    status: subscription.status,
    currentPeriodEnd: periodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}
