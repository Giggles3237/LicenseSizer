import { auth } from "@clerk/nextjs/server";
import { ACTIVITY_EVENT_TYPES } from "../../../lib/dealer";
import { getDealerProfile, getPublicDealerProfile, recordActivity } from "../../../lib/dealer-data";
import { getMonthlyPdfUsage } from "../../../lib/usage";

export const dynamic = "force-dynamic";

const channels = new Set(["native-share", "download", "email", "text"]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin activity is not accepted." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2048) return Response.json({ error: "Activity payload is too large." }, { status: 413 });
  const body = await request.json() as { publicSlug?: string; eventType?: string; deliveryChannel?: string };
  if (!body.eventType || !ACTIVITY_EVENT_TYPES.includes(body.eventType as typeof ACTIVITY_EVENT_TYPES[number])) {
    return Response.json({ error: "Unsupported activity event." }, { status: 400 });
  }
  const session = await auth();
  let organizationId = session.orgId ?? null;
  if (organizationId && !(await getDealerProfile(organizationId))) organizationId = null;
  if (!organizationId && body.publicSlug) organizationId = (await getPublicDealerProfile(body.publicSlug))?.organizationId ?? null;
  if (!organizationId) return new Response(null, { status: 204 });
  if (body.eventType === "pdf_created") {
    const usage = await getMonthlyPdfUsage(organizationId);
    if (!usage.allowed) return Response.json({ error: "This plan has reached its monthly PDF limit.", usage }, { status: 402 });
  }
  const deliveryChannel = body.deliveryChannel && channels.has(body.deliveryChannel) ? body.deliveryChannel : null;
  await recordActivity({
    organizationId,
    actorUserId: session.userId,
    actorType: session.userId ? "user" : "customer",
    eventType: body.eventType,
    deliveryChannel,
  });
  return new Response(null, { status: 204 });
}
