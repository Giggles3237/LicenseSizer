import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activityEvents, billingSubscriptions, dealerProfiles } from "../db/schema";
import type { DealerDeliveryProfile } from "./dealer";

const normalizeProfile = (row: typeof dealerProfiles.$inferSelect): DealerDeliveryProfile => ({
  dealerName: row.dealerName,
  publicSlug: row.publicSlug,
  destinationName: row.destinationName,
  destinationEmail: row.destinationEmail ?? "",
  destinationPhone: row.destinationPhone ?? "",
  messageSubject: row.messageSubject,
  messageBody: row.messageBody,
  backMode: row.backMode as DealerDeliveryProfile["backMode"],
  pageSize: row.pageSize as DealerDeliveryProfile["pageSize"],
  layout: row.layout as DealerDeliveryProfile["layout"],
  quality: row.quality as DealerDeliveryProfile["quality"],
  labels: row.labels,
  cropMarks: row.cropMarks,
});

export async function getDealerProfile(organizationId: string) {
  const [row] = await getDb().select().from(dealerProfiles).where(eq(dealerProfiles.organizationId, organizationId)).limit(1);
  return row ? normalizeProfile(row) : null;
}

export async function getPublicDealerProfile(publicSlug: string) {
  const [result] = await getDb().select({ profile: dealerProfiles, subscriptionStatus: billingSubscriptions.status })
    .from(dealerProfiles)
    .leftJoin(billingSubscriptions, eq(billingSubscriptions.organizationId, dealerProfiles.organizationId))
    .where(eq(dealerProfiles.publicSlug, publicSlug)).limit(1);
  if (!result) return null;
  if (process.env.STRIPE_SECRET_KEY && result.subscriptionStatus !== "active" && result.subscriptionStatus !== "trialing") return null;
  return { organizationId: result.profile.organizationId, profile: normalizeProfile(result.profile) };
}

export async function saveDealerProfile(organizationId: string, profile: DealerDeliveryProfile) {
  const [row] = await getDb().insert(dealerProfiles).values({
    organizationId,
    ...profile,
    destinationEmail: profile.destinationEmail || null,
    destinationPhone: profile.destinationPhone || null,
  }).onConflictDoUpdate({
    target: dealerProfiles.organizationId,
    set: {
      publicSlug: profile.publicSlug,
      dealerName: profile.dealerName,
      destinationName: profile.destinationName,
      destinationEmail: profile.destinationEmail || null,
      destinationPhone: profile.destinationPhone || null,
      messageSubject: profile.messageSubject,
      messageBody: profile.messageBody,
      backMode: profile.backMode,
      pageSize: profile.pageSize,
      layout: profile.layout,
      quality: profile.quality,
      labels: profile.labels,
      cropMarks: profile.cropMarks,
      updatedAt: new Date(),
    },
  }).returning();
  return normalizeProfile(row);
}

export async function recordActivity(input: {
  organizationId: string;
  actorUserId?: string | null;
  actorType: "user" | "customer";
  eventType: string;
  deliveryChannel?: string | null;
}) {
  await getDb().insert(activityEvents).values(input);
}

export async function getActivityReport(organizationId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const db = getDb();
  const [summary] = await db.select({
    sessions: sql<number>`count(*) filter (where ${activityEvents.eventType} = 'session_started')::int`,
    pdfs: sql<number>`count(*) filter (where ${activityEvents.eventType} = 'pdf_created')::int`,
    shares: sql<number>`count(*) filter (where ${activityEvents.eventType} in ('share_opened', 'email_opened', 'text_opened'))::int`,
    activeUsers: sql<number>`count(distinct ${activityEvents.actorUserId}) filter (where ${activityEvents.actorUserId} is not null)::int`,
  }).from(activityEvents).where(and(eq(activityEvents.organizationId, organizationId), gte(activityEvents.createdAt, since)));

  const recent = await db.select({
    id: activityEvents.id,
    actorUserId: activityEvents.actorUserId,
    actorType: activityEvents.actorType,
    eventType: activityEvents.eventType,
    deliveryChannel: activityEvents.deliveryChannel,
    createdAt: activityEvents.createdAt,
  }).from(activityEvents)
    .where(eq(activityEvents.organizationId, organizationId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(50);

  return { days, summary: summary ?? { sessions: 0, pdfs: 0, shares: 0, activeUsers: 0 }, recent };
}
