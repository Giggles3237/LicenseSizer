import { auth, clerkClient } from "@clerk/nextjs/server";
import { getBillingSubscription, getStripe, monthlyPdfLimitForPlan, priceIdForPlan, saveBillingSubscription, type PlanType } from "../../../../../lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId || !session.orgId) return Response.json({ error: "Organization sign-in required." }, { status: 401 });
  if (session.orgRole !== "org:admin") return Response.json({ error: "Organization admin access is required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { planType?: PlanType };
  const planType: PlanType = body.planType === "individual" ? "individual" : "dealer";
  const priceId = priceIdForPlan(planType);
  if (!priceId) return Response.json({ error: "Stripe pricing is not configured." }, { status: 503 });
  const stripe = getStripe();
  const existing = await getBillingSubscription(session.orgId);
  const organization = await (await clerkClient()).organizations.getOrganization({ organizationId: session.orgId });
  const customerId = existing?.stripeCustomerId || (await stripe.customers.create({ name: organization.name, metadata: { organizationId: session.orgId } })).id;
  if (!existing) await saveBillingSubscription({ organizationId: session.orgId, stripeCustomerId: customerId, planType, monthlyPdfLimit: monthlyPdfLimitForPlan(planType) });
  const openCheckouts = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 10 });
  const currentCheckout = openCheckouts.data.find((session) => session.mode === "subscription" && session.url && session.metadata?.planType === planType && session.success_url?.includes("session_id={CHECKOUT_SESSION_ID}"));
  if (currentCheckout?.url) return Response.json({ url: currentCheckout.url });
  const origin = new URL(request.url).origin;
  const trialDays = existing?.stripeSubscriptionId ? 0 : Math.max(0, Math.min(90, Number(process.env.STRIPE_TRIAL_DAYS || 14)));
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_collection: trialDays ? "if_required" : "always",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "required",
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX !== "false" },
    customer_update: { address: "auto", name: "auto" },
    subscription_data: {
      metadata: { organizationId: session.orgId, planType },
      ...(trialDays ? {
        trial_period_days: trialDays,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      } : {}),
    },
    metadata: { organizationId: session.orgId, planType },
    success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard?checkout=cancelled`,
  });
  return Response.json({ url: checkout.url });
}
