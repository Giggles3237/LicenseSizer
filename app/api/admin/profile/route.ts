import { auth, clerkClient } from "@clerk/nextjs/server";
import { createAvailablePublicSlug, getDealerProfile, saveDealerProfile } from "../../../../lib/dealer-data";
import { DEFAULT_DELIVERY_PROFILE, type DealerDeliveryProfile } from "../../../../lib/dealer";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56);
}

function externalUrl(value: string | undefined) {
  const trimmed = value?.trim().slice(0, 500) || "";
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

function imageDataUrl(value: string | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed.startsWith("data:image/")) return "";
  if (trimmed.length > 250_000) return "";
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(trimmed) ? trimmed : "";
}

function publicAssetOrExternalUrl(value: string | undefined) {
  const uploadedLogo = imageDataUrl(value);
  if (uploadedLogo) return uploadedLogo;
  const trimmed = value?.trim().slice(0, 500) || "";
  if (/^\/[a-z0-9/_\-.% ]+$/i.test(trimmed)) return trimmed;
  return externalUrl(trimmed);
}

function color(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value! : fallback;
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
  try {
    let profile = await getDealerProfile(access.organizationId);
    if (!profile) {
      if (access.session.orgRole !== "org:admin") return Response.json({ error: "An organization admin must finish dealership setup first." }, { status: 404 });
      const organization = await (await clerkClient()).organizations.getOrganization({ organizationId: access.organizationId });
      const baseSlug = slugify(organization.slug || organization.name) || "dealer";
      const publicSlug = await createAvailablePublicSlug(baseSlug);
      profile = await saveDealerProfile(access.organizationId, {
        ...DEFAULT_DELIVERY_PROFILE,
        dealerName: organization.name,
        publicSlug,
      });
    }
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return Response.json({ error: "The LicenseResizer database is not configured yet. Add DATABASE_URL in Vercel, then redeploy." }, { status: 503 });
    }
    if (typeof error === "object" && error && "cause" in error) {
      const cause = error.cause;
      if (typeof cause === "object" && cause && "code" in cause && cause.code === "42P01") {
        return Response.json({ error: "The LicenseResizer database setup is incomplete. Apply the database migration, then reload this page." }, { status: 503 });
      }
    }
    console.error("Unable to load dealership profile", error);
    return Response.json({ error: "The dealership workspace could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const access = await requireOrganization(true);
  if ("error" in access) return access.error;
  const body = await request.json() as Partial<DealerDeliveryProfile>;
  const profile: DealerDeliveryProfile = {
    dealerName: body.dealerName?.trim().slice(0, 100) || "",
    publicSlug: slugify(body.publicSlug || ""),
    publicAddress: body.publicAddress?.trim().slice(0, 300) || "",
    publicPhone: body.publicPhone?.trim().slice(0, 40) || "",
    publicEmail: body.publicEmail?.trim().toLowerCase().slice(0, 254) || "",
    websiteUrl: externalUrl(body.websiteUrl),
    facebookUrl: externalUrl(body.facebookUrl),
    logoUrl: publicAssetOrExternalUrl(body.logoUrl),
    landingHeadline: body.landingHeadline?.trim().slice(0, 140) || DEFAULT_DELIVERY_PROFILE.landingHeadline,
    landingDescription: body.landingDescription?.trim().slice(0, 600) || DEFAULT_DELIVERY_PROFILE.landingDescription,
    landingCta: body.landingCta?.trim().slice(0, 50) || DEFAULT_DELIVERY_PROFILE.landingCta,
    landingTheme: body.landingTheme === "modern" || body.landingTheme === "minimal" ? body.landingTheme : "classic",
    brandColor: color(body.brandColor, DEFAULT_DELIVERY_PROFILE.brandColor),
    accentColor: color(body.accentColor, DEFAULT_DELIVERY_PROFILE.accentColor),
    destinationName: body.destinationName?.trim().slice(0, 100) || "Sales team",
    destinationEmail: body.destinationEmail?.trim().toLowerCase().slice(0, 254) || "",
    destinationPhone: body.destinationPhone?.trim().slice(0, 40) || "",
    messageSubject: body.messageSubject?.trim().slice(0, 140) || "Driver's license copy",
    messageBody: body.messageBody?.trim().slice(0, 1000) || "Attached is the requested copy of my driver's license.",
    backMode: body.backMode === "front-only" ? "front-only" : "optional",
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
