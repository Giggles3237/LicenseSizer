import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDealerProfile, saveDealerProfile } from "../../../../lib/dealer-data";
import { DEFAULT_DELIVERY_PROFILE, type DealerDeliveryProfile } from "../../../../lib/dealer";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56);
}

async function requireOrganization(requireAdmin: boolean) {
  const session = await auth();
  if (!session.userId) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) };
  if (!session.orgId) return { error: Response.json({ error: "Choose or create an organization first." }, { status: 400 }) };
  if (requireAdmin && session.orgRole !== "org:admin") return { error: Response.json({ error: "Organization admin access is required." }, { status: 403 }) };
  return { session, organizationId: session.orgId };
}

export async function GET() {
  const access = await requireOrganization(false);
  if ("error" in access) return access.error;
  let profile = await getDealerProfile(access.organizationId);
  if (!profile) {
    if (access.session.orgRole !== "org:admin") return Response.json({ error: "An organization admin must finish dealership setup first." }, { status: 404 });
    const organization = await (await clerkClient()).organizations.getOrganization({ organizationId: access.organizationId });
    const baseSlug = slugify(organization.slug || organization.name) || "dealer";
    profile = await saveDealerProfile(access.organizationId, {
      ...DEFAULT_DELIVERY_PROFILE,
      dealerName: organization.name,
      publicSlug: `${baseSlug}-${access.organizationId.slice(-6).toLowerCase()}`,
    });
  }
  return Response.json({ profile });
}

export async function PUT(request: Request) {
  const access = await requireOrganization(true);
  if ("error" in access) return access.error;
  const body = await request.json() as Partial<DealerDeliveryProfile>;
  const profile: DealerDeliveryProfile = {
    dealerName: body.dealerName?.trim().slice(0, 100) || "",
    publicSlug: slugify(body.publicSlug || ""),
    destinationName: body.destinationName?.trim().slice(0, 100) || "Sales team",
    destinationEmail: body.destinationEmail?.trim().toLowerCase().slice(0, 254) || "",
    destinationPhone: body.destinationPhone?.trim().slice(0, 40) || "",
    messageSubject: body.messageSubject?.trim().slice(0, 140) || "Driver's license copy",
    messageBody: body.messageBody?.trim().slice(0, 1000) || "Attached is the requested copy of my driver's license.",
    backMode: body.backMode === "front-only" || body.backMode === "optional" ? body.backMode : "required",
    pageSize: body.pageSize === "a4" ? "a4" : "letter",
    layout: body.layout === "separate-pages" ? "separate-pages" : "stacked",
    quality: body.quality === "standard" ? "standard" : "high",
    labels: body.labels !== false,
    cropMarks: body.cropMarks === true,
  };
  if (!profile.dealerName || !profile.publicSlug) return Response.json({ error: "Dealer name and public link are required." }, { status: 400 });
  try {
    return Response.json({ profile: await saveDealerProfile(access.organizationId, profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("dealer_profiles_public_slug_idx")) return Response.json({ error: "That public link is already in use." }, { status: 409 });
    throw error;
  }
}
