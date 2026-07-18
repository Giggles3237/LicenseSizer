import { auth, clerkClient } from "@clerk/nextjs/server";
import { getActivityReport } from "../../../../lib/dealer-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session.userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!session.orgId) return Response.json({ error: "Choose an organization first." }, { status: 400 });
  if (session.orgRole !== "org:admin") return Response.json({ error: "Organization admin access is required." }, { status: 403 });
  const report = await getActivityReport(session.orgId);
  const userIds = [...new Set(report.recent.flatMap((event) => event.actorUserId ? [event.actorUserId] : []))];
  const labels = new Map<string, string>();
  if (userIds.length) {
    const users = await (await clerkClient()).users.getUserList({ userId: userIds, limit: 100 });
    for (const user of users.data) labels.set(user.id, user.fullName || user.primaryEmailAddress?.emailAddress || "Organization user");
  }
  return Response.json({ ...report, recent: report.recent.map((event) => ({ ...event, actorLabel: event.actorUserId ? labels.get(event.actorUserId) || "Organization user" : "Customer link" })) });
}
