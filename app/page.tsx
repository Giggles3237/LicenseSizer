import Link from "next/link";
import type { Metadata } from "next";
import LicenseResizerBrand from "./brand-logo";

const APP_STORE_URL = "https://apps.apple.com/us/app/licenseresizer/id6820282296";
const ENTERPRISE_URL = "mailto:support@licenseresizer.com?subject=LicenseResizer%20enterprise%20inquiry";
const title = "LicenseResizer for iPhone — True-size license PDFs · $2.99";
const description = "Scan, straighten, and create true-size license PDFs privately on your iPhone. $2.99 on the US App Store. No account or subscription. Enterprise inquiries welcome.";
export const metadata: Metadata = { title, description, alternates: { canonical: "/" }, openGraph: { title, description, type: "website", images: [{ url: "/LicenseResizerLogo.webp", alt: "LicenseResizer" }] }, twitter: { card: "summary", title, description, images: ["/LicenseResizerLogo.webp"] }, other: { "apple-itunes-app": "app-id=6820282296" } };

function MockLicense({ small = false }: { small?: boolean }) {
  return (
    <div className={`proof-license${small ? " small" : ""}`} aria-hidden="true">
      <div className="proof-license-top"><span>DRIVER LICENSE</span><i>LR</i></div>
      <div className="proof-license-body">
        <div className="proof-license-photo" />
        <div className="proof-license-lines"><i /><i /><i /><i /></div>
      </div>
      <div className="proof-license-footer"><span /><span /></div>
    </div>
  );
}

function HeroTransformation() {
  return (
    <div className="hero-transform-card" aria-label="Before and after license preparation preview">
      <div className="hero-before">
        <span className="transform-label">Before</span>
        <div className="surface-lines" />
        <MockLicense />
        <span className="photo-flash" />
      </div>
      <div className="transform-arrow" aria-hidden="true">-&gt;</div>
      <div className="hero-after">
        <span className="transform-label">After</span>
        <div className="pdf-page hero-pdf-page">
          <span className="pdf-label">LICENSE COPY</span>
          <MockLicense small />
          <span className="pdf-dimensions">PDF READY TO SHARE</span>
        </div>
      </div>
    </div>
  );
}

const faqs = [
  { question: "Is this a subscription?", answer: "No. LicenseResizer for iPhone is a $2.99 purchase on the US App Store, with no account, subscription, or advertisements. Prices in other regions may vary; check your local App Store." },
  { question: "Which iPhones can use LicenseResizer?", answer: "The app requires iOS 17.0 or later. Download it from the App Store on a compatible iPhone." },
  { question: "Do my license photos get uploaded?", answer: "The iPhone app processes license photos and PDFs on your device. LicenseResizer does not upload or retain your document data. Files leave the app only when you choose to save, print, or share them." },
  { question: "Can I include the back of the license?", answer: "Yes. Create a front-only or front-and-back PDF, then use the native Share, Save, or Print actions." },
  { question: "How do I print at the correct size?", answer: "The app places the card at standard ID-1 dimensions (85.60 × 53.98 mm) on a US Letter PDF. Use US Letter paper and Actual Size or 100% in your printer settings. Turn off Fit, Scale to Fit, and Shrink Oversized Pages." },
  { question: "What if my organization needs a different workflow?", answer: "Contact support@licenseresizer.com to discuss your organization’s needs. Enterprise arrangements are discussed individually; the $2.99 App Store price is for the iPhone app." },
  { question: "Can existing web customers still sign in?", answer: "Yes. Use Web sign in to access your existing workspace and billing. The web capture flow also remains available. The iPhone app purchase is separate from existing web plans." },
];

export default function Home() {
  return (
    <main className="marketing-shell app-landing">
      <nav className="marketing-nav" aria-label="Main navigation">
        <LicenseResizerBrand href="#top" />
        <div className="marketing-nav-links">
          <a href="#how-it-works">The app</a>
          <a href="#enterprise">Enterprise</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link className="nav-sign-in" href="/sign-in">Web sign in</Link>
          <Link className="nav-cta" href={APP_STORE_URL} data-analytics="app-store">Get the app <span aria-hidden="true">↗</span></Link>
        </div>
      </nav>

      <section className="marketing-hero" id="top">
        <div className="hero-copy">
          <p className="marketing-kicker"><span /> Now available for iPhone</p>
          <h1>Your license.<br /><em>True to size.</em></h1>
          <p className="hero-lede">Scan, straighten, and turn a driver’s license into a print-ready PDF at its true physical size. Privately, on your iPhone.</p>
          <div className="hero-actions">
            <Link className="primary marketing-primary" href={APP_STORE_URL} data-analytics="app-store">Get on the App Store · $2.99 <span aria-hidden="true">-&gt;</span></Link>
            <a className="secondary marketing-secondary" href="#enterprise">For your organization</a>
          </div>
          <div className="hero-proof" aria-label="Product benefits">
            <span><b>✓</b> No subscription</span>
            <span><b>✓</b> On-device processing</span>
            <span><b>✓</b> iOS 17 or later</span>
          </div>
        </div>

        <div className="hero-product hero-transform" aria-label="Crooked photo transformed into a prepared PDF">
          <div className="preview-glow" />
          <HeroTransformation />
          <div className="floating-card floating-private"><span className="float-icon">OK</span><div><b>Private by design</b><small>Processed on your iPhone</small></div></div>
          <div className="floating-card floating-complete"><span className="float-check">PDF</span><div><b>True-size PDF</b><small>Save, share, or print</small></div></div>
        </div>
      </section>

      <section className="dealer-strip" aria-label="iPhone app benefits">
        <p>A useful document copy. A simpler everyday task.</p>
        <ul className="dealer-trust-list"><li>One-time app purchase</li><li>No account</li><li>No advertisements</li><li>Private processing on iPhone</li></ul>
      </section>

      <section className="proof-section" id="proof" aria-labelledby="proof-heading">
        <div className="section-heading">
          <p className="marketing-kicker"><span /> See the transformation</p>
          <h2 id="proof-heading">From an ordinary phone photo to a usable PDF.</h2>
          <p>You stay in control. Capture the card, adjust its corners if needed, and choose how to use the finished PDF.</p>
        </div>
        <div className="proof-flow">
          <article>
            <div className="proof-visual photo-proof">
              <div className="seat-seam" />
              <MockLicense />
              <span className="proof-badge">Phone photo</span>
            </div>
            <div className="proof-copy"><span>01</span><div><h3>Capture</h3><p>Guided camera framing with automatic capture or a manual shutter.</p></div></div>
          </article>
          <span className="proof-arrow" aria-hidden="true">→</span>
          <article>
            <div className="proof-visual crop-proof">
              <div className="crop-grid" />
              <MockLicense />
              <i className="proof-corner tl" /><i className="proof-corner tr" /><i className="proof-corner bl" /><i className="proof-corner br" />
              <span className="proof-badge">Review the crop</span>
            </div>
            <div className="proof-copy"><span>02</span><div><h3>Review</h3><p>Automatic perspective correction, with four-corner adjustment when needed.</p></div></div>
          </article>
          <span className="proof-arrow" aria-hidden="true">→</span>
          <article>
            <div className="proof-visual pdf-proof">
              <div className="pdf-page">
                <span className="pdf-label">LICENSE COPY</span>
                <MockLicense small />
                <span className="pdf-dimensions">TRUE-SIZE OUTPUT</span>
              </div>
              <span className="proof-badge">PDF ready</span>
            </div>
            <div className="proof-copy"><span>03</span><div><h3>Share</h3><p>A US Letter PDF with the card at its standard physical size.</p></div></div>
          </article>
        </div>
        <p className="proof-note">Illustrated workflow, not app screenshots. No personal license information is shown.</p>
        <a className="secondary proof-demo-cta" href={APP_STORE_URL}>See the app on the App Store <span aria-hidden="true">↗</span></a>
      </section>

      <section className="problem-section" id="how-it-works">
        <div><p className="marketing-kicker">Made for the task</p><h2>Less resizing.<br />More getting on with your day.</h2></div>
        <p>A focused iPhone app for creating a clean license copy, without an account or a subscription.</p>
      </section>
      <section className="workflow-section" aria-label="App capabilities">
        <article><span>01</span><div className="feature-icon">⌗</div><h3>Capture and correct</h3><p>Use guided framing and perspective correction. Adjust all four corners when the crop needs help.</p></article>
        <article><span>02</span><div className="feature-icon">▤</div><h3>Choose your sides</h3><p>Create a front-only or front-and-back PDF at standard ID-1 card dimensions.</p></article>
        <article><span>03</span><div className="feature-icon">↗</div><h3>Save, share, or print</h3><p>Use native iPhone actions. You choose where the finished document goes.</p></article>
      </section>

      <section className="privacy-section" id="privacy">
        <div className="privacy-seal"><span>◉</span><small>ON-DEVICE<br />PROCESSING</small></div>
        <div><p className="marketing-kicker light">Privacy is the product</p><h2>The license image never becomes our data.</h2></div>
        <div><p>The iPhone app processes photos and PDFs on your device. LicenseResizer does not upload, retain, analyze, or sell your document data. Files leave the app only when you choose to save, print, or share them.</p><a href="/privacy">Read our privacy policy <span>→</span></a></div>
      </section>

      <section className="pricing-section" id="pricing" aria-labelledby="pricing-heading">
        <div className="section-heading">
          <p className="marketing-kicker"><span /> Simple app pricing</p>
          <h2 id="pricing-heading">One app. One purchase.</h2>
          <p>Get LicenseResizer for iPhone, or talk with us about your organization’s workflow.</p>
        </div>
        <div className="plan-grid">
          <article className="plan-card featured">
            <span className="plan-kicker">iPhone app</span><h3>Ready when you need a copy</h3>
            <div className="plan-volume"><strong>$2.99</strong><span>one-time purchase<br />US App Store</span></div>
            <ul><li>True-size, US Letter PDFs</li><li>Front-only or front-and-back</li><li>No account, subscription, or ads</li></ul>
            <a className="primary" href={APP_STORE_URL}>Get on the App Store</a>
          </article>
          <article className="plan-card" id="enterprise">
            <span className="plan-kicker">Enterprise inquiries</span><h3>For dealerships &amp; organizations</h3>
            <p>Have a team or business workflow in mind? Tell us what you need and we’ll discuss the fit.</p>
            <ul><li>Describe your organization and workflow</li><li>Share your requirements and questions</li><li>Please don’t include license images or personal document details</li></ul>
            <a className="secondary" href={ENTERPRISE_URL}>Discuss enterprise needs</a>
            <p className="enterprise-contact">Email <a href={ENTERPRISE_URL}>support@licenseresizer.com</a></p>
          </article>
        </div>
        <p className="pricing-note">App Store pricing may vary by region. Enterprise inquiries are separate from the iPhone app purchase.</p>
        <p className="pricing-note">Already using the web product? <Link href="/sign-in">Sign in to your workspace</Link> for existing access and billing, or <Link href="/capture">open web capture</Link>.</p>
      </section>

      <section className="faq-section" id="faq" aria-labelledby="faq-heading">
        <div className="faq-intro">
          <p className="marketing-kicker"><span /> Common questions</p>
          <h2 id="faq-heading">The details people usually ask about.</h2>
          <p>A few details about the iPhone app, printing, and existing web access.</p>
          <a href="/support">Get support <span aria-hidden="true">→</span></a>
        </div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary>{faq.question}<span aria-hidden="true">+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="marketing-kicker">A clean copy, in your pocket</p>
        <h2>Your next license PDF starts here.</h2>
        <p>Capture, straighten, and prepare a true-size PDF on your iPhone.</p>
        <Link className="primary marketing-primary" href={APP_STORE_URL} data-analytics="app-store">Get LicenseResizer · $2.99 <span>→</span></Link>
        <small>One-time app purchase · iOS 17 or later</small>
      </section>

      <footer className="marketing-footer">
        <LicenseResizerBrand href="#top" />
        <p>True-size license PDFs. Privately on iPhone.</p>
        <div><a href="/capture">Web capture</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link href="/sign-in">Web sign in</Link><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/support">Support</a></div>
        <small>© {new Date().getFullYear()} LicenseResizer. LicenseResizer resizes documents; it does not verify identity, authenticity, or delivery.</small>
      </footer>
    </main>
  );
}
