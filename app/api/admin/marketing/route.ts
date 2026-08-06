import { auth, currentUser } from "@clerk/nextjs/server";
import { getDealerProfile } from "../../../../lib/dealer-data";
import { EMPTY_MARKETING_CONTACT, getMarketingContact, saveMarketingContact, type MarketingContact } from "../../../../lib/marketing";
import { notifyMarketingContactSaved } from "../../../../lib/marketing-notifications";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session.userId) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) };
  if (!session.orgId) return { error: Response.json({ error: "Choose or create an organization first." }, { status: 400 }) };
  if (session.orgRole !== "org:admin") return { error: Response.json({ error: "Organization admin access is required." }, { status: 403 }) };
  return { session, organizationId: session.orgId };
}

function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanContact(body: Partial<MarketingContact>): MarketingContact {
  return {
    contactName: cleanText(body.contactName, 100),
    contactEmail: cleanEmail(body.contactEmail),
    contactPhone: cleanText(body.contactPhone, 40),
    role: cleanText(body.role, 80),
    crm: cleanText(body.crm, 120),
    referralSource: cleanText(body.referralSource, 160),
    notes: cleanText(body.notes, 1000),
    emailOptIn: body.emailOptIn !== false,
  };
}

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const existing = await getMarketingContact(access.organizationId);
  if (existing) return Response.json({ contact: existing });

  const user = await currentUser();
  return Response.json({
    contact: {
      ...EMPTY_MARKETING_CONTACT,
      contactName: user?.fullName || "",
      contactEmail: user?.primaryEmailAddress?.emailAddress || "",
    },
  });
}

export async function PUT(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => ({})) as Partial<MarketingContact>;
  const contact = cleanContact(body);
  if (!contact.contactName || !contact.contactEmail) {
    return Response.json({ error: "Name and email are required." }, { status: 400 });
  }

  const saved = await saveMarketingContact({
    ...contact,
    organizationId: access.organizationId,
    clerkUserId: access.session.userId,
  });
  await notifyMarketingContactSaved(access.organizationId, await getDealerProfile(access.organizationId));
  return Response.json({ contact: saved });
}
