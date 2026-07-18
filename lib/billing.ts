import "server-only";

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { billingSubscriptions } from "../db/schema";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key);
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
