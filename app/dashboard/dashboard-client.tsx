"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DealerDeliveryProfile } from "../../lib/dealer";

type Report = {
  days: number;
  summary: { sessions: number; pdfs: number; shares: number; activeUsers: number };
  recent: Array<{ id: string; actorType: string; actorUserId: string | null; actorLabel?: string; eventType: string; deliveryChannel: string | null; createdAt: string }>;
};
type Billing = { configured: boolean; hasAccess: boolean; subscription: null | { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } };

async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      // Treat an empty or malformed response as a server error below.
    }
  }

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : fallback;
    throw new Error(message);
  }

  if (!payload) throw new Error(fallback);
  return payload as T;
}

const eventLabels: Record<string, string> = {
  session_started: "Started a license session", front_captured: "Captured the front", back_captured: "Captured the back",
  pdf_created: "Created a PDF", share_opened: "Opened the share sheet", pdf_downloaded: "Downloaded a PDF",
  email_opened: "Opened an email draft", text_opened: "Opened a text draft", session_cleared: "Cleared the session",
};

export default function DashboardClient({ canManage }: { canManage: boolean }) {
  const [profile, setProfile] = useState<DealerDeliveryProfile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [status, setStatus] = useState("Loading dealership workspace…");
  const [tab, setTab] = useState<"overview" | "delivery" | "team" | "billing">("overview");

  const load = useCallback(async () => {
    try {
      const profileResponse = await fetch("/api/admin/profile");
      const profilePayload = await readApiResponse<{ profile: DealerDeliveryProfile }>(profileResponse, "Unable to load dealership settings. Please try again.");
      setProfile(profilePayload.profile);
      if (!canManage) { setStatus(""); return; }
      const [reportResponse, billingResponse] = await Promise.all([fetch("/api/admin/report"), fetch("/api/admin/billing")]);
      const [reportPayload, billingPayload] = await Promise.all([
        readApiResponse<Report>(reportResponse, "Unable to load activity reporting."),
        readApiResponse<Billing>(billingResponse, "Unable to load billing information."),
      ]);
      setReport(reportPayload);
      setBilling(billingPayload);
      setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load the dashboard."); }
  }, [canManage]);

  // The async load synchronizes this client view with the organization APIs.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setStatus("Saving dealership settings…");
    const response = await fetch("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    try {
      const payload = await readApiResponse<{ profile: DealerDeliveryProfile }>(response, "Settings could not be saved.");
      setProfile(payload.profile);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Settings could not be saved.");
    }
  };

  const publicUrl = profile && typeof window !== "undefined" ? `${window.location.origin}/d/${profile.publicSlug}` : "";
  const openBilling = async (kind: "checkout" | "portal") => {
    setStatus(kind === "checkout" ? "Opening secure checkout…" : "Opening billing portal…");
    const response = await fetch(`/api/admin/billing/${kind}`, { method: "POST" });
    try {
      const payload = await readApiResponse<{ url: string }>(response, "Billing could not be opened.");
      window.location.href = payload.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Billing could not be opened.");
    }
  };

  return <div className="admin-layout">
    <aside className="admin-sidebar"><div><span className="step-kicker">Organization</span><h1>Dealer console</h1><p>Configure delivery, manage people, and see whether customers finish the handoff.</p></div><nav aria-label="Dealer console"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>{canManage && <button className={tab === "delivery" ? "active" : ""} onClick={() => setTab("delivery")}>Delivery setup</button>}<button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>Admins & users</button>{canManage && <button className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")}>Plan & billing</button>}</nav><Link className="secondary" href={publicUrl || "/"}>Open organization scanner</Link></aside>
    <section className="admin-content">
      {status && <div className="notice" role="status">{status}</div>}
      {tab === "overview" && <><div className="admin-heading"><div><span className="step-kicker">Last 30 days</span><h2>Delivery activity</h2></div>{publicUrl && <button className="secondary" onClick={() => navigator.clipboard.writeText(publicUrl)}>Copy customer link</button>}</div>
        {!canManage ? <div className="admin-card"><h3>User access</h3><p>You can use the organization’s scanner. An organization admin controls team settings and reporting.</p></div> : <>
          <div className="metric-grid"><div><strong>{report?.summary.sessions ?? 0}</strong><span>Sessions started</span></div><div><strong>{report?.summary.pdfs ?? 0}</strong><span>PDFs created</span></div><div><strong>{report?.summary.shares ?? 0}</strong><span>Delivery actions</span></div><div><strong>{report?.summary.activeUsers ?? 0}</strong><span>Active signed-in users</span></div></div>
          <div className="admin-card"><h3>Recent activity</h3><div className="activity-list">{report?.recent.length ? report.recent.map((item) => <div key={item.id}><span className="activity-icon" aria-hidden="true">{item.eventType === "pdf_created" ? "PDF" : "✓"}</span><p><strong>{eventLabels[item.eventType] ?? item.eventType}</strong><span>{item.actorLabel || (item.actorType === "customer" ? "Customer link" : "Organization user")}{item.deliveryChannel ? ` · ${item.deliveryChannel}` : ""}</span></p><time>{new Date(item.createdAt).toLocaleString()}</time></div>) : <p className="empty-copy">Activity will appear after customers or team members use your dealer link.</p>}</div></div>
        </>}
      </>}
      {tab === "delivery" && canManage && profile && <><div className="admin-heading"><div><span className="step-kicker">Customer handoff</span><h2>Delivery setup</h2><p>These details appear when someone uses your dealership link.</p></div></div><form className="admin-form admin-card" onSubmit={saveProfile}>
        <label>Dealership name<input value={profile.dealerName} onChange={(event) => setProfile({ ...profile, dealerName: event.target.value })} required /></label>
        <label>Customer link<span className="input-prefix">/d/</span><input className="prefixed" value={profile.publicSlug} onChange={(event) => setProfile({ ...profile, publicSlug: event.target.value })} required /></label>
        <div className="form-grid"><label>Destination label<input value={profile.destinationName} onChange={(event) => setProfile({ ...profile, destinationName: event.target.value })} /></label><label>Destination email<input type="email" value={profile.destinationEmail} onChange={(event) => setProfile({ ...profile, destinationEmail: event.target.value })} placeholder="sales@dealer.com" /></label></div>
        <label>Destination mobile number<input type="tel" value={profile.destinationPhone} onChange={(event) => setProfile({ ...profile, destinationPhone: event.target.value })} placeholder="Optional" /></label>
        <label>Email subject<input value={profile.messageSubject} onChange={(event) => setProfile({ ...profile, messageSubject: event.target.value })} /></label>
        <label>Preset message<textarea rows={5} value={profile.messageBody} onChange={(event) => setProfile({ ...profile, messageBody: event.target.value })} /></label>
        <fieldset className="policy-fieldset"><legend>Capture policy</legend><div className="form-grid three"><label>License sides<select value={profile.backMode} onChange={(event) => setProfile({ ...profile, backMode: event.target.value as DealerDeliveryProfile["backMode"] })}><option value="required">Front and back required</option><option value="optional">Back is optional</option><option value="front-only">Front only</option></select></label><label>Paper size<select value={profile.pageSize} onChange={(event) => setProfile({ ...profile, pageSize: event.target.value as DealerDeliveryProfile["pageSize"] })}><option value="letter">US Letter</option><option value="a4">A4</option></select></label><label>Page layout<select value={profile.layout} onChange={(event) => setProfile({ ...profile, layout: event.target.value as DealerDeliveryProfile["layout"] })} disabled={profile.backMode === "front-only"}><option value="stacked">Stacked on one page</option><option value="separate-pages">Separate pages</option></select></label></div><div className="form-grid"><label>Image detail<select value={profile.quality} onChange={(event) => setProfile({ ...profile, quality: event.target.value as DealerDeliveryProfile["quality"] })}><option value="high">High detail</option><option value="standard">Standard / smaller file</option></select></label><div className="admin-checks"><label><input type="checkbox" checked={profile.labels} onChange={(event) => setProfile({ ...profile, labels: event.target.checked })} /> Label front and back</label><label><input type="checkbox" checked={profile.cropMarks} onChange={(event) => setProfile({ ...profile, cropMarks: event.target.checked })} /> Add crop marks</label></div></div></fieldset>
        <div className="form-actions"><button className="primary" type="submit">Save delivery setup</button>{publicUrl && <a className="secondary" href={publicUrl} target="_blank" rel="noreferrer">Preview customer link</a>}</div>
      </form></>}
      {tab === "team" && <><div className="admin-heading"><div><span className="step-kicker">Access control</span><h2>Admins & users</h2><p>Invite dealership staff and assign organization roles.</p></div></div><div className="clerk-panel"><OrganizationProfile routing="hash" /></div></>}
      {tab === "billing" && canManage && <><div className="admin-heading"><div><span className="step-kicker">Subscription</span><h2>Plan & billing</h2><p>LicenseSizer is billed once per dealership organization.</p></div></div><div className="admin-card billing-card"><div className={`billing-status ${billing?.hasAccess ? "active" : ""}`}><span /><div><strong>{billing?.subscription?.status ? billing.subscription.status.replace("_", " ") : "No active plan"}</strong><p>{billing?.subscription?.currentPeriodEnd ? `Current period ends ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}.` : "Start a subscription to activate your customer delivery link."}</p></div></div>{!billing?.configured ? <div className="notice">Add the Stripe values from <code>.env.example</code> to enable checkout.</div> : billing?.subscription ? <button className="primary" onClick={() => void openBilling("portal")}>Manage billing</button> : <button className="primary" onClick={() => void openBilling("checkout")}>Start free trial</button>}<p className="billing-note">Payments, invoices, tax calculation, and card details are handled securely by Stripe. LicenseSizer never receives card numbers.</p></div></>}
    </section>
  </div>;
}
