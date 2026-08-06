import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activityEvents, billingSubscriptions, dealerProfiles, marketingContacts } from "../db/schema";

export type PlatformLead = {
  organizationId: string;
  dealerName: string;
  publicSlug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  role: string;
  crm: string;
  referralSource: string;
  notes: string;
  emailOptIn: boolean;
  thankYouSentAt: string | null;
  trialStartedNotifiedAt: string | null;
  subscriptionStatus: string | null;
  planType: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  sessions: number;
  pdfs: number;
  handoffActions: number;
  latestActivityAt: string | null;
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getPlatformOverview() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const db = getDb();
  const [summary] = await db.select({
    organizations: sql<number>`count(distinct ${dealerProfiles.organizationId})::int`,
    contacts: sql<number>`count(distinct ${marketingContacts.organizationId}) filter (where ${marketingContacts.organizationId} is not null)::int`,
    trialing: sql<number>`count(distinct ${billingSubscriptions.organizationId}) filter (where ${billingSubscriptions.status} = 'trialing')::int`,
    active: sql<number>`count(distinct ${billingSubscriptions.organizationId}) filter (where ${billingSubscriptions.status} = 'active')::int`,
    pdfs30: sql<number>`count(${activityEvents.id}) filter (where ${activityEvents.eventType} = 'pdf_created' and ${activityEvents.createdAt} >= ${since})::int`,
  }).from(dealerProfiles)
    .leftJoin(marketingContacts, eq(marketingContacts.organizationId, dealerProfiles.organizationId))
    .leftJoin(billingSubscriptions, eq(billingSubscriptions.organizationId, dealerProfiles.organizationId))
    .leftJoin(activityEvents, eq(activityEvents.organizationId, dealerProfiles.organizationId));

  const activityRows = await db.select({
    organizationId: activityEvents.organizationId,
    sessions: sql<number>`count(*) filter (where ${activityEvents.eventType} = 'session_started')::int`,
    pdfs: sql<number>`count(*) filter (where ${activityEvents.eventType} = 'pdf_created')::int`,
    handoffActions: sql<number>`count(*) filter (where ${activityEvents.eventType} in ('share_opened', 'pdf_downloaded', 'email_opened', 'text_opened'))::int`,
    latestActivityAt: sql<Date | null>`max(${activityEvents.createdAt})`,
  }).from(activityEvents).groupBy(activityEvents.organizationId);
  const activityByOrg = new Map(activityRows.map((row) => [row.organizationId, row]));

  const rows = await db.select({
    organizationId: dealerProfiles.organizationId,
    dealerName: dealerProfiles.dealerName,
    publicSlug: dealerProfiles.publicSlug,
    createdAt: dealerProfiles.createdAt,
    contactName: marketingContacts.contactName,
    contactEmail: marketingContacts.contactEmail,
    contactPhone: marketingContacts.contactPhone,
    role: marketingContacts.role,
    crm: marketingContacts.crm,
    referralSource: marketingContacts.referralSource,
    notes: marketingContacts.notes,
    emailOptIn: marketingContacts.emailOptIn,
    thankYouSentAt: marketingContacts.thankYouSentAt,
    trialStartedNotifiedAt: marketingContacts.trialStartedNotifiedAt,
    subscriptionStatus: billingSubscriptions.status,
    planType: billingSubscriptions.planType,
    currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
  }).from(dealerProfiles)
    .leftJoin(marketingContacts, eq(marketingContacts.organizationId, dealerProfiles.organizationId))
    .leftJoin(billingSubscriptions, eq(billingSubscriptions.organizationId, dealerProfiles.organizationId))
    .orderBy(desc(dealerProfiles.createdAt))
    .limit(100);

  const leads: PlatformLead[] = rows.map((row) => {
    const activity = activityByOrg.get(row.organizationId);
    return {
      organizationId: row.organizationId,
      dealerName: row.dealerName,
      publicSlug: row.publicSlug,
      contactName: row.contactName ?? "",
      contactEmail: row.contactEmail ?? "",
      contactPhone: row.contactPhone ?? "",
      role: row.role ?? "",
      crm: row.crm ?? "",
      referralSource: row.referralSource ?? "",
      notes: row.notes ?? "",
      emailOptIn: row.emailOptIn ?? false,
      thankYouSentAt: iso(row.thankYouSentAt),
      trialStartedNotifiedAt: iso(row.trialStartedNotifiedAt),
      subscriptionStatus: row.subscriptionStatus,
      planType: row.planType,
      currentPeriodEnd: iso(row.currentPeriodEnd),
      createdAt: iso(row.createdAt) ?? new Date().toISOString(),
      sessions: activity?.sessions ?? 0,
      pdfs: activity?.pdfs ?? 0,
      handoffActions: activity?.handoffActions ?? 0,
      latestActivityAt: iso(activity?.latestActivityAt),
    };
  });

  return {
    summary: summary ?? { organizations: 0, contacts: 0, trialing: 0, active: 0, pdfs30: 0 },
    leads,
  };
}
