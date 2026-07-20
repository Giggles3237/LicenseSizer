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

  return <main className={`dealer-landing theme-${profile.landingTheme}`} style={colors}>
    <header className="dealer-landing-header">
      <Link className="dealer-identity" href={`/d/${profile.publicSlug}`}>
        {profile.logoUrl ? <span className="dealer-logo" role="img" aria-label={`${profile.dealerName} logo`} style={{ backgroundImage: `url(${profile.logoUrl})` }} /> : <span className="dealer-initial">{profile.dealerName.slice(0, 1)}</span>}
        <span><strong>{profile.dealerName}</strong><small>Secure document delivery</small></span>
      </Link>
      {profile.publicPhone && <a className="dealer-header-phone" href={phoneHref}>Call {profile.publicPhone}</a>}
    </header>

    <section className="dealer-hero">
      <div className="dealer-hero-copy"><span className="dealer-eyebrow">Private · Simple · On your device</span><h1>{profile.landingHeadline}</h1><p>{profile.landingDescription}</p><div className="dealer-hero-actions"><Link className="dealer-start-button" href={`/d/${profile.publicSlug}/scan`}>{profile.landingCta}<span aria-hidden="true">→</span></Link><span>No account required</span></div></div>
      <div className="dealer-privacy-card"><span className="dealer-shield" aria-hidden="true">✓</span><h2>Your license stays private.</h2><p>Photos and PDFs are processed in this browser. LicenseSizer does not store your license image or document.</p><ul><li>True-size PDF output</li><li>Nothing uploaded to LicenseSizer</li><li>You choose how to send it</li></ul></div>
    </section>

    {(profile.publicAddress || profile.publicPhone || profile.publicEmail || profile.websiteUrl || profile.facebookUrl) && <section className="dealer-contact-section"><div><span className="dealer-eyebrow">Contact us</span><h2>{profile.dealerName}</h2></div><address>
      {profile.publicAddress && <p><span>Address</span>{profile.publicAddress}</p>}
      {profile.publicPhone && <p><span>Phone</span><a href={phoneHref}>{profile.publicPhone}</a></p>}
      {profile.publicEmail && <p><span>Email</span><a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a></p>}
      {profile.websiteUrl && <p><span>Online</span><a href={profile.websiteUrl} target="_blank" rel="noreferrer">{websiteLabel}</a></p>}
      {profile.facebookUrl && <p><span>Social</span><a href={profile.facebookUrl} target="_blank" rel="noreferrer">Facebook</a></p>}
    </address></section>}

    <footer className="dealer-landing-footer"><span>Private document preparation powered by <strong>LicenseSizer</strong></span><nav aria-label="Legal and support"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav><Link href={`/d/${profile.publicSlug}/scan`}>Begin scan</Link></footer>
  </main>;
}
