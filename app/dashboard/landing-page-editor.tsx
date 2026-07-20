"use client";

import type { CSSProperties, Dispatch, FormEventHandler, SetStateAction } from "react";
import type { DealerDeliveryProfile } from "../../lib/dealer";

type Props = {
  profile: DealerDeliveryProfile;
  setProfile: Dispatch<SetStateAction<DealerDeliveryProfile | null>>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  publicUrl: string;
};

export default function LandingPageEditor({ profile, setProfile, onSubmit, publicUrl }: Props) {
  const update = <Key extends keyof DealerDeliveryProfile>(key: Key, value: DealerDeliveryProfile[Key]) => {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  };
  const colors = { "--dealer-brand": profile.brandColor, "--dealer-accent": profile.accentColor } as CSSProperties;

  return <>
    <div className="admin-heading"><div><span className="step-kicker">Your public presence</span><h2>Landing page</h2><p>Customize what customers see before they begin scanning.</p></div>{publicUrl && <a className="secondary" href={publicUrl} target="_blank" rel="noreferrer">Open live page</a>}</div>
    <div className="landing-editor-grid">
      <form className="admin-form admin-card" onSubmit={onSubmit}>
        <h3>Dealership identity</h3>
        <label>Dealership name<input value={profile.dealerName} onChange={(event) => update("dealerName", event.target.value)} required /></label>
        <label>Public link<span className="input-prefix">/d/</span><input className="prefixed" value={profile.publicSlug} onChange={(event) => update("publicSlug", event.target.value)} required /></label>
        <label>Logo URL<input type="url" value={profile.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://example.com/logo.png" /></label>

        <h3>Page content</h3>
        <label>Headline<input value={profile.landingHeadline} onChange={(event) => update("landingHeadline", event.target.value)} maxLength={140} /></label>
        <label>Description<textarea rows={5} value={profile.landingDescription} onChange={(event) => update("landingDescription", event.target.value)} maxLength={600} /></label>
        <label>Button text<input value={profile.landingCta} onChange={(event) => update("landingCta", event.target.value)} maxLength={50} /></label>

        <h3>Contact details</h3>
        <label>Address<textarea rows={3} value={profile.publicAddress} onChange={(event) => update("publicAddress", event.target.value)} placeholder={"123 Main Street\nAnytown, NY 10001"} /></label>
        <div className="form-grid"><label>Public phone<input type="tel" value={profile.publicPhone} onChange={(event) => update("publicPhone", event.target.value)} /></label><label>Public email<input type="email" value={profile.publicEmail} onChange={(event) => update("publicEmail", event.target.value)} /></label></div>
        <label>Website<input type="url" value={profile.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://dealership.com" /></label>
        <label>Facebook page<input type="url" value={profile.facebookUrl} onChange={(event) => update("facebookUrl", event.target.value)} placeholder="https://facebook.com/dealership" /></label>

        <h3>Appearance</h3>
        <div className="form-grid three"><label>Layout<select value={profile.landingTheme} onChange={(event) => update("landingTheme", event.target.value as DealerDeliveryProfile["landingTheme"])}><option value="classic">Classic</option><option value="modern">Modern</option><option value="minimal">Minimal</option></select></label><label>Brand color<input className="color-input" type="color" value={profile.brandColor} onChange={(event) => update("brandColor", event.target.value)} /></label><label>Accent color<input className="color-input" type="color" value={profile.accentColor} onChange={(event) => update("accentColor", event.target.value)} /></label></div>
        <div className="form-actions"><button className="primary" type="submit">Save landing page</button></div>
      </form>

      <aside className="landing-preview-wrap"><span className="step-kicker">Live preview</span><div className={`dealer-preview theme-${profile.landingTheme}`} style={colors}>
        <div className="dealer-preview-header">{profile.logoUrl ? <span className="dealer-preview-logo" role="img" aria-label={`${profile.dealerName} logo`} style={{ backgroundImage: `url(${profile.logoUrl})` }} /> : <span className="dealer-preview-initial">{profile.dealerName.slice(0, 1) || "D"}</span>}<strong>{profile.dealerName || "Your dealership"}</strong></div>
        <div className="dealer-preview-copy"><small>Secure document delivery</small><h3>{profile.landingHeadline}</h3><p>{profile.landingDescription}</p><span className="dealer-preview-button">{profile.landingCta}</span></div>
        {(profile.publicAddress || profile.publicPhone || profile.websiteUrl) && <div className="dealer-preview-contact">{profile.publicAddress && <span>{profile.publicAddress}</span>}{profile.publicPhone && <span>{profile.publicPhone}</span>}{profile.websiteUrl && <span>Website</span>}</div>}
      </div></aside>
    </div>
  </>;
}
