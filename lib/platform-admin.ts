import "server-only";

type PlatformUser = {
  primaryEmailAddress?: { emailAddress?: string | null } | null;
} | null | undefined;

function configuredAdminEmails() {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || process.env.MARKETING_NOTIFY_EMAIL || "";
  return new Set(raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isPlatformAdmin(user: PlatformUser) {
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return Boolean(email && configuredAdminEmails().has(email));
}
