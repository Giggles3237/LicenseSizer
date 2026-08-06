import { auth, currentUser } from "@clerk/nextjs/server";
import { isPlatformAdmin } from "../../../../../lib/platform-admin";
import { sendThankYouEmail } from "../../../../../lib/marketing-notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isPlatformAdmin(await currentUser())) return Response.json({ error: "Platform admin access is required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { organizationId?: string; force?: boolean };
  if (!body.organizationId) return Response.json({ error: "Organization id is required." }, { status: 400 });
  const result = await sendThankYouEmail(body.organizationId, body.force === true);
  if (!result.sent) return Response.json({ error: result.reason || "The thank-you email could not be sent." }, { status: 400 });
  return Response.json({ ok: true });
}
