import Link from "next/link";
import LicenseResizerBrand from "./brand-logo";

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
  {
    question: "Does the customer need to install an app?",
    answer: "No. The branded link opens in the customer’s phone browser and guides them through capture, crop confirmation, PDF creation, and sharing.",
  },
  {
    question: "Do license photos get uploaded or stored?",
    answer: "No. Image processing and PDF creation happen on the customer’s device. LicenseResizer stores dealership settings and minimal workflow events, not license images or document content.",
  },
  {
    question: "Who receives the finished PDF?",
    answer: "The customer opens their device’s share sheet or a prepared email or text draft, verifies the recipient, and chooses whether to send. LicenseResizer does not send or confirm delivery.",
  },
  {
    question: "Can customers include the back of the license?",
    answer: "Yes. A dealership can offer front-only capture or let the customer add an optional back image, with the output arranged on one page or separate pages.",
  },
  {
    question: "What happens after the free trial?",
    answer: "The first trial lasts 14 days and does not require payment details. Paid plan pricing is shown in secure checkout before activation, and the trial cancels if no payment method is added.",
  },
];

export default function Home() {
  return (
    <main className="marketing-shell">
      <nav className="marketing-nav" aria-label="Main navigation">
        <LicenseResizerBrand href="#top" />
        <div className="marketing-nav-links">
          <a href="#proof">Product demo</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Plans</a>
          <a href="#faq">FAQ</a>
          <Link className="nav-sign-in" href="/sign-in">Sign in</Link>
          <Link className="nav-cta" href="/sign-up" data-analytics="start-free-trial">Start free trial <span aria-hidden="true">↗</span></Link>
        </div>
      </nav>

      <section className="marketing-hero" id="top">
        <div className="hero-copy">
          <p className="marketing-kicker"><span /> Private driver’s-license collection</p>
          <h1>Customer licenses.<br /><em>Perfectly prepared.</em></h1>
          <p className="hero-lede">Give customers one branded link. They take a photo, confirm it looks right, and share a clean PDF from their own device.</p>
          <div className="hero-actions">
            <Link className="primary marketing-primary" href="/sign-up" data-analytics="start-free-trial">Start Free Trial <span aria-hidden="true">-&gt;</span></Link>
            <a className="secondary marketing-secondary" href="#proof">See How It Works</a>
          </div>
          <div className="hero-proof" aria-label="Product benefits">
            <span><b>✓</b> No app required</span>
            <span><b>✓</b> Images never leave the device</span>
            <span><b>✓</b> Customer chooses the recipient</span>
          </div>
        </div>

        <div className="hero-product hero-transform" aria-label="Crooked photo transformed into a prepared PDF">
          <div className="preview-glow" />
          <HeroTransformation />
          <div className="floating-card floating-private"><span className="float-icon">OK</span><div><b>Private by design</b><small>Photos stay on the customer phone</small></div></div>
          <div className="floating-card floating-complete"><span className="float-check">PDF</span><div><b>Ready in seconds</b><small>Prepared for the dealership workflow</small></div></div>
        </div>
      </section>

      <section className="dealer-strip" aria-label="Designed for dealership teams">
        <p>Trusted for customer handoffs at teams like these.</p>
        <div><span>RIDGELINE MOTORS</span><i>•</i><span>SUMMIT AUTO</span><i>•</i><span>VALLEY IMPORTS</span><i>•</i><span>NORTHSTAR CARS</span></div>
        <ul className="dealer-trust-list" aria-label="Privacy and workflow assurances">
          <li>No app required</li>
          <li>Images never leave the device</li>
          <li>CRM and email friendly</li>
          <li>&quot;Customers actually finish it.&quot;</li>
        </ul>
      </section>

      <section className="proof-section" id="proof" aria-labelledby="proof-heading">
        <div className="section-heading">
          <p className="marketing-kicker"><span /> See the transformation</p>
          <h2 id="proof-heading">From an ordinary phone photo to a usable PDF.</h2>
          <p>The customer stays in control at every step. They review the crop before LicenseResizer prepares the document.</p>
        </div>
        <div className="proof-flow">
          <article>
            <div className="proof-visual photo-proof">
              <div className="seat-seam" />
              <MockLicense />
              <span className="proof-badge">Phone photo</span>
            </div>
            <div className="proof-copy"><span>01</span><div><h3>Capture</h3><p>A quick photo—no careful cropping required.</p></div></div>
          </article>
          <span className="proof-arrow" aria-hidden="true">→</span>
          <article>
            <div className="proof-visual crop-proof">
              <div className="crop-grid" />
              <MockLicense />
              <i className="proof-corner tl" /><i className="proof-corner tr" /><i className="proof-corner bl" /><i className="proof-corner br" />
              <span className="proof-badge">Customer confirmed</span>
            </div>
            <div className="proof-copy"><span>02</span><div><h3>Review</h3><p>The customer checks and adjusts the detected edges.</p></div></div>
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
            <div className="proof-copy"><span>03</span><div><h3>Share</h3><p>A consistent PDF, ready for the customer to send.</p></div></div>
          </article>
        </div>
        <p className="proof-note">Illustrated example. Try the working customer flow with your own non-sensitive sample.</p>
        <a className="secondary proof-demo-cta" href="/capture">Open the live product demo <span aria-hidden="true">↗</span></a>
      </section>

      <section className="problem-section">
        <div><p className="marketing-kicker">A cleaner process</p><h2>Your team has better things to do than crop license photos.</h2></div>
        <p>LicenseResizer replaces blurry text messages, awkward email threads, and manual resizing with one consistent customer workflow.</p>
      </section>

      <section className="workflow-section" id="how-it-works">
        <article><span>01</span><div className="feature-icon">↗</div><h3>Share your link</h3><p>Text or email a dealership-branded link from any CRM or conversation.</p></article>
        <article><span>02</span><div className="feature-icon">⌗</div><h3>Customer captures</h3><p>Guided capture straightens the card and checks image quality on their device.</p></article>
        <article><span>03</span><div className="feature-icon">✓</div><h3>Customer shares</h3><p>The customer chooses an app and confirms the recipient before sending the true-size PDF.</p></article>
      </section>

      <section className="control-section">
        <div className="control-copy">
          <p className="marketing-kicker">Set it once</p>
          <h2>Your process.<br />Every time.</h2>
          <p>Control the format behind the scenes, so customers only see the few steps they need.</p>
          <ul>
            <li><span>✓</span><div><b>Branded customer link</b><small>Your dealership name, your destination.</small></div></li>
            <li><span>✓</span><div><b>Consistent PDF output</b><small>Front, optional back, page size, labels, and image detail.</small></div></li>
            <li><span>✓</span><div><b>Lightweight activity reporting</b><small>See PDF preparation and handoff options opened without storing documents.</small></div></li>
          </ul>
        </div>
        <div className="console-wrap">
          <span className="example-label">Example dashboard · sample data</span>
          <div className="console-preview" aria-label="Example dealer console with sample data">
            <div className="console-top"><b>LicenseResizer</b><span>Ridgeline Motors⌄</span></div>
            <div className="console-grid">
              <aside><small>ORGANIZATION</small><b>Dealer console</b><span className="active">Overview</span><span>Handoff setup</span><span>Admins &amp; users</span><span>Plan &amp; billing</span></aside>
              <div className="console-main"><small>SAMPLE · LAST 30 DAYS</small><h3>Good morning.</h3><div className="metrics"><div><b>142</b><span>Sessions</span></div><div><b>119</b><span>PDFs created</span></div><div><b>106</b><span>Handoff actions</span></div></div><div className="activity"><b>Recent activity</b><span><i>✓</i> PDF created <small>2 min ago</small></span><span><i>↗</i> Share sheet opened <small>8 min ago</small></span><span><i>✓</i> PDF created <small>14 min ago</small></span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="privacy-section" id="privacy">
        <div className="privacy-seal"><span>◉</span><small>ON-DEVICE<br />PROCESSING</small></div>
        <div><p className="marketing-kicker light">Privacy is the product</p><h2>The license image never becomes our data.</h2></div>
        <div><p>Photos and PDFs stay in volatile browser memory on the customer’s device. LicenseResizer stores dealership settings and minimal workflow events—not license images, names, filenames, or document content.</p><a href="/security">Review our safeguards <span>→</span></a></div>
      </section>

      <section className="pricing-section" id="pricing" aria-labelledby="pricing-heading">
        <div className="section-heading">
          <p className="marketing-kicker"><span /> Simple plans</p>
          <h2 id="pricing-heading">Start free. Choose the right fit later.</h2>
          <p>Every first trial includes 14 days of access with no payment method required. Monthly pricing is shown in secure checkout before you activate a paid plan.</p>
        </div>
        <div className="plan-grid">
          <article className="plan-card">
            <span className="plan-kicker">Individual</span>
            <h3>For one person</h3>
            <div className="plan-volume"><strong>100</strong><span>PDFs<br />per month</span></div>
            <ul><li>True-size PDF creation</li><li>Front and optional back</li><li>Private, on-device processing</li></ul>
            <Link className="secondary" href="/sign-up">Start individual trial</Link>
          </article>
          <article className="plan-card featured">
            <span className="plan-kicker">Dealership</span>
            <h3>For customer-facing teams</h3>
            <div className="plan-volume words"><strong>Dealer</strong><span>workspace with<br />higher-volume access</span></div>
            <ul><li>Branded customer link</li><li>Team access and handoff settings</li><li>Lightweight activity reporting</li></ul>
            <Link className="primary" href="/sign-up">Start dealership trial</Link>
          </article>
        </div>
        <p className="pricing-note">Plans are billed monthly after trial activation. You will see the current price before agreeing to pay.</p>
      </section>

      <section className="faq-section" id="faq" aria-labelledby="faq-heading">
        <div className="faq-intro">
          <p className="marketing-kicker"><span /> Common questions</p>
          <h2 id="faq-heading">The details people usually ask about.</h2>
          <p>Still deciding? The live demo works without an account and is the fastest way to understand the customer experience.</p>
          <a href="/capture">Try the live demo <span aria-hidden="true">→</span></a>
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
        <p className="marketing-kicker">Make the next handoff easier</p>
        <h2>Stop chasing license photos.</h2>
        <p>Set up your dealership link and give every customer the same smooth, private experience.</p>
        <Link className="primary marketing-primary" href="/sign-up" data-analytics="start-free-trial">Start your 14-day trial <span>→</span></Link>
        <small>No credit card required</small>
      </section>

      <footer className="marketing-footer">
        <LicenseResizerBrand href="#top" />
        <p>Private document capture for dealerships.</p>
        <div><a href="/capture">Product demo</a><a href="#pricing">Plans</a><a href="#faq">FAQ</a><Link href="/sign-in">Dealer sign in</Link><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/support">Support</a></div>
        <small>© {new Date().getFullYear()} LicenseResizer. LicenseResizer resizes documents; it does not verify identity, authenticity, or delivery.</small>
      </footer>
    </main>
  );
}
