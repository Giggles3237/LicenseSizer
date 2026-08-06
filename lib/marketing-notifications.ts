import "server-only";

import { emailDeliveryConfigured, notificationRecipient, sendEmail, supportEmailAddress } from "./email";
import { claimInternalSignupNotification, claimThankYouNotification, claimTrialStartedNotification, getMarketingContact, getMarketingContactRecord, markThankYouSent } from "./marketing";
import type { DealerDeliveryProfile } from "./dealer";

function publicLink(profile?: DealerDeliveryProfile | null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
  if (!siteUrl || !profile?.publicSlug) return "";
  const origin = siteUrl.startsWith("http") ? siteUrl.replace(/\/$/, "") : `https://${siteUrl.replace(/\/$/, "")}`;
  return `${origin}/d/${profile.publicSlug}`;
}

function contactSummary(contact: Awaited<ReturnType<typeof getMarketingContact>>, profile?: DealerDeliveryProfile | null) {
  if (!contact) return "";
  return [
    `Dealership: ${profile?.dealerName || "Unknown"}`,
    `Contact: ${contact.contactName}`,
    `Email: ${contact.contactEmail}`,
    contact.contactPhone ? `Phone: ${contact.contactPhone}` : "",
    contact.role ? `Role: ${contact.role}` : "",
    contact.crm ? `CRM/DMS: ${contact.crm}` : "",
    contact.referralSource ? `Source: ${contact.referralSource}` : "",
    contact.notes ? `Notes: ${contact.notes}` : "",
    publicLink(profile) ? `Public link: ${publicLink(profile)}` : "",
    `Email opt-in: ${contact.emailOptIn ? "yes" : "no"}`,
  ].filter(Boolean).join("\n");
}

function thankYouText(contactName: string) {
  return [
    `Hi ${contactName.split(" ")[0] || "there"},`,
    "",
    "Thanks for setting up LicenseResizer. I wanted to personally say hello and make sure you have help if you need it.",
    "",
    "A good next step is to confirm your dealership page, add your handoff destination, then run one practice scan from the customer link.",
    "",
    "Reply here any time and I can help with setup, workflow questions, or making the customer handoff fit your store.",
    "",
    "Chris",
    "LicenseResizer",
  ].join("\n");
}

export async function sendThankYouEmail(organizationId: string, force = false) {
  if (!emailDeliveryConfigured()) return { sent: false, reason: "Email is not configured." };
  const contact = await getMarketingContactRecord(organizationId);
  if (!contact) return { sent: false, reason: "No follow-up contact exists for this organization." };
  if (!contact.emailOptIn) return { sent: false, reason: "The contact has not opted in to product/support email." };
  if (contact.thankYouSentAt && !force) return { sent: false, reason: "The thank-you email was already sent." };
  const result = await sendEmail({
    to: contact.contactEmail,
    subject: "Thanks for trying LicenseResizer",
    text: thankYouText(contact.contactName),
    replyTo: supportEmailAddress(),
  });
  if (result.sent) await markThankYouSent(organizationId);
  return result;
}

export async function notifyMarketingContactSaved(organizationId: string, profile?: DealerDeliveryProfile | null) {
  const notifyTo = notificationRecipient();
  if (emailDeliveryConfigured() && notifyTo) {
    const internalContact = await claimInternalSignupNotification(organizationId);
    if (internalContact) {
      await sendEmail({
        to: notifyTo,
        subject: `New LicenseResizer lead: ${profile?.dealerName || internalContact.contactName}`,
        text: `A dealer admin saved follow-up details in LicenseResizer.\n\n${contactSummary(internalContact, profile)}`,
        replyTo: internalContact.contactEmail,
      });
    }
  }

  if (!emailDeliveryConfigured()) return;
  const thankYouContact = await claimThankYouNotification(organizationId);
  if (thankYouContact?.emailOptIn) {
    await sendEmail({
      to: thankYouContact.contactEmail,
      subject: "Thanks for trying LicenseResizer",
      text: thankYouText(thankYouContact.contactName),
      replyTo: supportEmailAddress(),
    });
  }
}

export async function notifyTrialStarted(organizationId: string, profile?: DealerDeliveryProfile | null) {
  const notifyTo = notificationRecipient();
  if (!emailDeliveryConfigured() || !notifyTo) return;
  const contact = await claimTrialStartedNotification(organizationId);
  if (!contact) return;
  await sendEmail({
    to: notifyTo,
    subject: `LicenseResizer trial started: ${profile?.dealerName || contact.contactName}`,
    text: `A LicenseResizer trial started.\n\n${contactSummary(contact, profile)}`,
    replyTo: contact.contactEmail,
  });
}
