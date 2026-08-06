"use client";

import { useState } from "react";
import type { PlatformLead } from "../../lib/platform-data";

type BackendClientProps = {
  leads: PlatformLead[];
  siteOrigin: string;
  emailConfigured: boolean;
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function statusLabel(lead: PlatformLead) {
  if (!lead.subscriptionStatus) return "No plan";
  return `${lead.planType || "dealer"} - ${lead.subscriptionStatus.replace("_", " ")}`;
}

export default function BackendClient({ leads, siteOrigin, emailConfigured }: BackendClientProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const sendThankYou = async (organizationId: string, force: boolean) => {
    setSending(organizationId);
    setMessages((current) => ({ ...current, [organizationId]: "" }));
    try {
      const response = await fetch("/api/platform/marketing/thank-you", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, force }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Email could not be sent.");
      setMessages((current) => ({ ...current, [organizationId]: "Thank-you email sent." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [organizationId]: error instanceof Error ? error.message : "Email could not be sent." }));
    } finally {
      setSending(null);
    }
  };

  return <div className="platform-lead-list">
    {!emailConfigured && <div className="notice">Email sending is not configured yet. Add <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code>, and <code>MARKETING_NOTIFY_EMAIL</code> to enable thank-you and internal notification emails.</div>}
    {leads.length ? leads.map((lead) => {
      const publicUrl = `${siteOrigin}/d/${lead.publicSlug}`;
      const canSend = Boolean(lead.contactEmail && lead.emailOptIn && emailConfigured);
      return <article className="admin-card platform-lead-card" key={lead.organizationId}>
        <div className="platform-lead-top">
          <div>
            <span className="step-kicker">{statusLabel(lead)}</span>
            <h3>{lead.dealerName}</h3>
            <p>{lead.contactName ? `${lead.contactName} · ${lead.contactEmail}` : "No follow-up contact saved yet"}</p>
          </div>
          <div className="platform-lead-actions">
            <a className="secondary" href={publicUrl} target="_blank" rel="noreferrer">Open page</a>
            <button className="primary" type="button" disabled={!canSend || sending === lead.organizationId} onClick={() => void sendThankYou(lead.organizationId, Boolean(lead.thankYouSentAt))}>{lead.thankYouSentAt ? "Resend thanks" : "Send thanks"}</button>
          </div>
        </div>
        <div className="platform-lead-meta">
          <span><strong>{lead.sessions}</strong> sessions</span>
          <span><strong>{lead.pdfs}</strong> PDFs</span>
          <span><strong>{lead.handoffActions}</strong> handoff actions</span>
          <span><strong>{dateLabel(lead.latestActivityAt)}</strong> latest activity</span>
        </div>
        <dl className="platform-lead-details">
          <div><dt>Phone</dt><dd>{lead.contactPhone || "Not provided"}</dd></div>
          <div><dt>Role</dt><dd>{lead.role || "Not provided"}</dd></div>
          <div><dt>CRM/DMS</dt><dd>{lead.crm || "Not provided"}</dd></div>
          <div><dt>Source</dt><dd>{lead.referralSource || "Not provided"}</dd></div>
          <div><dt>Thank-you</dt><dd>{dateLabel(lead.thankYouSentAt)}</dd></div>
          <div><dt>Trial alert</dt><dd>{dateLabel(lead.trialStartedNotifiedAt)}</dd></div>
        </dl>
        {lead.notes && <p className="platform-lead-notes">{lead.notes}</p>}
        {messages[lead.organizationId] && <p className="platform-lead-message" role="status">{messages[lead.organizationId]}</p>}
      </article>;
    }) : <div className="admin-card"><h3>No leads yet</h3><p className="empty-copy">Dealer organizations will appear here after a workspace/profile exists.</p></div>}
  </div>;
}
