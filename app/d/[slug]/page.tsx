import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getPublicDealerProfile } from "../../../lib/dealer-data";

export const dynamic = "force-dynamic";

export default async function DealerCapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let result = null;
  try { result = await getPublicDealerProfile(slug); } catch { notFound(); }
  if (!result) notFound();
  const profile = result.profile;
  const colors = { "--dealer-brand": profile.brandColor, "--dealer-accent": profile.accentColor } as CSSProperties;
  const websiteLabel = profile.websiteUrl ? (() => { try { return new URL(profile.websiteUrl).hostname.replace(/^www\./, ""); } catch { return "Website"; } })() : "";
  const phoneHref = `tel:${profile.publicPhone.replace(/[^+\d]/g, "")}`;
  const destinationDetail = profile.destinationEmail || profile.destinationPhone || profile.destinationName;

  return <main className={`dealer-landing theme-${profile.landingTheme}`} style={colors}>
    <header className="dealer-landing-header">
      <Link className="dealer-identity" href={`/d/${profile.publicSlug}`}>
        {profile.logoUrl ? <span className="dealer-logo" role="img" aria-label={`${profile.dealerName} logo`} style={{ backgroundImage: `url(${profile.logoUrl})` }} /> : <span className="dealer-initial">{profile.dealerName.slice(0, 1)}</span>}
        <span><strong>{profile.dealerName}</strong><small>Customer license intake</small></span>
      </Link>
      {profile.publicPhone && <a className="dealer-header-phone" href={phoneHref}>Call {profile.publicPhone}</a>}
    </header>

    <section className="dealer-hero">
      <div className="dealer-hero-copy">
        <span className="dealer-eyebrow">Requested by {profile.dealerName}</span>
        <h1>{profile.landingHeadline}</h1>
        <p>{profile.landingDescription}</p>
        <div className="dealer-visit-summary" aria-label="Customer request details">
          <div><span>Needed for</span><strong>Test drive or purchase paperwork</strong></div>
          <div><span>Estimated time</span><strong>About 2 minutes</strong></div>
          <div><span>Send to</span><strong>{destinationDetail}</strong></div>
        </div>
        <div className="dealer-hero-actions"><Link className="dealer-start-button" href={`/d/${profile.publicSlug}/scan`}>{profile.landingCta}<span aria-hidden="true">-&gt;</span></Link><span>No account required. Use your own phone.</span></div>
      </div>
      <div className="dealer-intake-card">
        {profile.logoUrl ? <span className="dealer-card-logo" role="img" aria-label={`${profile.dealerName} logo`} style={{ backgroundImage: `url(${profile.logoUrl})` }} /> : <span className="dealer-initial">{profile.dealerName.slice(0, 1)}</span>}
        <span className="dealer-card-kicker">Customer document request</span>
        <h2>Before you arrive</h2>
        <p>Prepare a true-size license PDF and choose the app you want to use to send it to the dealership.</p>
        <ol>
          <li><span>1</span><strong>Photograph the front</strong><small>The back is optional if requested.</small></li>
          <li><span>2</span><strong>Review the framing</strong><small>Nothing leaves your device while the PDF is created.</small></li>
          <li><span>3</span><strong>Send it yourself</strong><small>Confirm the recipient before sending.</small></li>
        </ol>
      </div>
    </section>

    <section className="dealer-reassurance-section" aria-label="Privacy and sizing details">
      <article><span className="dealer-shield" aria-hidden="true">OK</span><h2>Your license stays private.</h2><p>Photos and PDFs are processed in this browser. LicenseResizer does not store your license image or document.</p></article>
      <article><span className="dealer-shield" aria-hidden="true">1:1</span><h2>True-size PDF output.</h2><p>The final PDF places the license at nominal ID-1 size so the dealership gets a clean copy for its workflow.</p></article>
      <article><span className="dealer-shield" aria-hidden="true">You</span><h2>You control the handoff.</h2><p>Your device opens the sharing option. You choose the app, verify the recipient, and finish sending.</p></article>
    </section>

    {(profile.publicAddress || profile.publicPhone || profile.publicEmail || profile.websiteUrl || profile.facebookUrl) && <section className="dealer-contact-section"><div><span className="dealer-eyebrow">Contact us</span><h2>{profile.dealerName}</h2></div><address>
      {profile.publicAddress && <p><span>Address</span>{profile.publicAddress}</p>}
      {profile.publicPhone && <p><span>Phone</span><a href={phoneHref}>{profile.publicPhone}</a></p>}
      {profile.publicEmail && <p><span>Email</span><a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a></p>}
      {profile.websiteUrl && <p><span>Online</span><a href={profile.websiteUrl} target="_blank" rel="noreferrer">{websiteLabel}</a></p>}
      {profile.facebookUrl && <p><span>Social</span><a href={profile.facebookUrl} target="_blank" rel="noreferrer">Facebook</a></p>}
    </address></section>}

    <footer className="dealer-landing-footer"><span>Private document preparation powered by <strong>LicenseResizer</strong></span><nav aria-label="Legal and support"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav><Link href={`/d/${profile.publicSlug}/scan`}>Begin scan</Link></footer>
  </main>;
}
