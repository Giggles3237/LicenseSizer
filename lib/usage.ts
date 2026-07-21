import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activityEvents } from "../db/schema";
import { getBillingSubscription, hasProductAccess } from "./billing";

export type PdfUsage = {
  allowed: boolean;
  used: number;
  limit: number | null;
  resetsAt: string;
};

export function currentUsageWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getMonthlyPdfUsage(organizationId: string): Promise<PdfUsage> {
  const subscription = await getBillingSubscription(organizationId);
  const { start, end } = currentUsageWindow();
  const [summary] = await getDb().select({
    used: sql<number>`count(*)::int`,
  }).from(activityEvents).where(and(
    eq(activityEvents.organizationId, organizationId),
    eq(activityEvents.eventType, "pdf_created"),
    gte(activityEvents.createdAt, start),
    lt(activityEvents.createdAt, end),
  ));
  const used = summary?.used ?? 0;
  const limit = hasProductAccess(subscription?.status) ? subscription?.monthlyPdfLimit ?? null : 0;
  return { allowed: limit === null || used < limit, used, limit, resetsAt: end.toISOString() };
}
