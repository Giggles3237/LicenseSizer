import { auth } from "@clerk/nextjs/server";
import { getDealerProfile, getPublicDealerProfile } from "../../../../lib/dealer-data";
import { getMonthlyPdfUsage } from "../../../../lib/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin activity is not accepted." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { publicSlug?: string };
  const session = await auth();
  let organizationId = session.orgId ?? null;
  if (organizationId && !(await getDealerProfile(organizationId))) organizationId = null;
  if (!organizationId && body.publicSlug) organizationId = (await getPublicDealerProfile(body.publicSlug))?.organizationId ?? null;
  if (!organizationId) return Response.json({ allowed: true, used: 0, limit: null, resetsAt: null });
  return Response.json(await getMonthlyPdfUsage(organizationId));
}
