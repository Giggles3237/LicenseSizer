import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { marketingContacts } from "../db/schema";

export type MarketingContact = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  role: string;
  crm: string;
  referralSource: string;
  notes: string;
  emailOptIn: boolean;
};

export type MarketingContactInput = MarketingContact & {
  organizationId: string;
  clerkUserId?: string | null;
};

export const EMPTY_MARKETING_CONTACT: MarketingContact = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  role: "",
  crm: "",
  referralSource: "",
  notes: "",
  emailOptIn: true,
};

function normalize(row: typeof marketingContacts.$inferSelect): MarketingContact {
  return {
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone ?? "",
    role: row.role ?? "",
    crm: row.crm ?? "",
    referralSource: row.referralSource ?? "",
    notes: row.notes ?? "",
    emailOptIn: row.emailOptIn,
  };
}

export async function getMarketingContact(organizationId: string) {
  const [row] = await getDb().select().from(marketingContacts).where(eq(marketingContacts.organizationId, organizationId)).limit(1);
  return row ? normalize(row) : null;
}

export async function getMarketingContactRecord(organizationId: string) {
  const [row] = await getDb().select().from(marketingContacts).where(eq(marketingContacts.organizationId, organizationId)).limit(1);
  return row ?? null;
}

export async function saveMarketingContact(input: MarketingContactInput) {
  const values = {
    organizationId: input.organizationId,
    clerkUserId: input.clerkUserId || null,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone || null,
    role: input.role || null,
    crm: input.crm || null,
    referralSource: input.referralSource || null,
    notes: input.notes || null,
    emailOptIn: input.emailOptIn,
  };
  const [row] = await getDb().insert(marketingContacts).values(values).onConflictDoUpdate({
    target: marketingContacts.organizationId,
    set: { ...values, updatedAt: new Date() },
  }).returning();
  return normalize(row);
}

async function claimNotificationTimestamp(organizationId: string, column: "internalSignupNotifiedAt" | "trialStartedNotifiedAt" | "thankYouSentAt") {
  const [row] = await getDb().update(marketingContacts)
    .set({ [column]: new Date(), updatedAt: new Date() })
    .where(and(eq(marketingContacts.organizationId, organizationId), isNull(marketingContacts[column])))
    .returning();
  return row ? normalize(row) : null;
}

export async function claimInternalSignupNotification(organizationId: string) {
  return claimNotificationTimestamp(organizationId, "internalSignupNotifiedAt");
}

export async function claimTrialStartedNotification(organizationId: string) {
  return claimNotificationTimestamp(organizationId, "trialStartedNotifiedAt");
}

export async function claimThankYouNotification(organizationId: string) {
  return claimNotificationTimestamp(organizationId, "thankYouSentAt");
}

export async function markThankYouSent(organizationId: string) {
  const [row] = await getDb().update(marketingContacts)
    .set({ thankYouSentAt: new Date(), updatedAt: new Date() })
    .where(eq(marketingContacts.organizationId, organizationId))
    .returning();
  return row ? normalize(row) : null;
}
