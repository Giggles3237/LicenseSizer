import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export function notificationRecipient() {
  return process.env.MARKETING_NOTIFY_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL || "";
}

export function supportEmailAddress() {
  return process.env.SUPPORT_REPLY_TO_EMAIL || process.env.MARKETING_NOTIFY_EMAIL || "support@licenseresizer.com";
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL));
}

export async function sendEmail({ to, subject, text, replyTo }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) return { sent: false, reason: "Email is not configured." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Unable to send email", response.status, detail);
    return { sent: false, reason: "Email provider rejected the message." };
  }

  return { sent: true };
}
