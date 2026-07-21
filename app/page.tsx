export default function Home() {
  return (
    <main className="marketing-shell">
      <nav className="marketing-nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="LicenseResizer home"><span className="brand-mark" aria-hidden="true"><i /></span><span>License<span>Resizer</span></span></a>
        <div className="marketing-nav-links"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a><a href="/dashboard">Sign in</a><a className="nav-cta" href="/dashboard">Start free trial <span aria-hidden="true">↗</span></a></div>
      </nav>

      <section className="marketing-hero" id="top">
        <div className="hero-copy">
          <p className="marketing-kicker"><span /> Built for modern dealerships</p>
          <h1>License collection,<br /><em>without the chase.</em></h1>
          <p className="hero-lede">Give customers a branded link that turns a phone photo into a clean, correctly sized PDF—ready to send to your team in minutes.</p>
          <div className="hero-actions"><a className="primary marketing-primary" href="/dashboard">Start your free trial <span aria-hidden="true">→</span></a><a className="text-cta" href="/capture">Try the customer experience <span aria-hidden="true">↗</span></a></div>
          <div className="hero-proof" aria-label="Product benefits"><span><b>✓</b> No card required</span><span><b>✓</b> Setup in minutes</span><span><b>✓</b> Images never stored</span></div>
        </div>

        <div className="hero-product" aria-label="LicenseResizer customer workflow preview">
          <div className="preview-glow" />
          <div className="phone-frame"><div className="phone-bar"><span /><b>LicenseResizer</b><i>•••</i></div><div className="phone-body"><small>RIDGELINE MOTORS</small><h2>Send us your<br />license copy.</h2><p>Take a quick photo. We’ll straighten it and prepare the PDF.</p><div className="scan-card"><span className="scan-corner tl" /><span className="scan-corner tr" /><span className="scan-corner bl" /><span className="scan-corner br" /><div className="license-avatar" /><div className="license-lines"><i /><i /><i /></div></div><button type="button" tabIndex={-1}>Scan my license <span>→</span></button><small className="device-note">● Processed on this device</small></div></div>
          <div className="floating-card floating-private"><span className="float-icon">◉</span><div><b>Private by design</b><small>Photos stay on the customer’s phone</small></div></div>
          <div className="floating-card floating-complete"><span className="float-check">✓</span><div><b>Share sheet opened</b><small>Customer chooses the recipient</small></div></div>
        </div>
      </section>

      <section className="dealer-strip" aria-label="Designed for dealership teams"><p>One less document to chase. One smoother handoff.</p><div><span>SALES</span><i>•</i><span>F&amp;I</span><i>•</i><span>BDC</span><i>•</i><span>INTERNET TEAMS</span></div></section>

      <section className="problem-section"><div><p className="marketing-kicker">A cleaner process</p><h2>Your team has better things to do than crop license photos.</h2></div><p>LicenseResizer replaces blurry text messages, awkward email threads, and manual resizing with one consistent customer workflow.</p></section>

      <section className="workflow-section" id="how-it-works">
        <article><span>01</span><div className="feature-icon">↗</div><h3>Share your link</h3><p>Text or email a dealership-branded link from any CRM or conversation.</p></article>
        <article><span>02</span><div className="feature-icon">⌗</div><h3>Customer captures</h3><p>Guided capture straightens the card and checks image quality on their device.</p></article>
        <article><span>03</span><div className="feature-icon">✓</div><h3>Customer shares</h3><p>The customer chooses an app and confirms the recipient before sending the true-size PDF.</p></article>
      </section>

      <section className="control-section">
        <div className="control-copy"><p className="marketing-kicker">Set it once</p><h2>Your process.<br />Every time.</h2><p>Control the format behind the scenes, so customers only see the few steps they need.</p><ul><li><span>✓</span><div><b>Branded customer link</b><small>Your dealership name, your destination.</small></div></li><li><span>✓</span><div><b>Consistent PDF output</b><small>Front, optional back, page size, labels, and image detail.</small></div></li><li><span>✓</span><div><b>Lightweight activity reporting</b><small>See PDF preparation and handoff options opened without storing documents.</small></div></li></ul></div>
        <div className="console-preview" aria-label="Dealer console preview"><div className="console-top"><b>LicenseResizer</b><span>Ridgeline Motors⌄</span></div><div className="console-grid"><aside><small>ORGANIZATION</small><b>Dealer console</b><span className="active">Overview</span><span>Handoff setup</span><span>Admins &amp; users</span><span>Plan &amp; billing</span></aside><div className="console-main"><small>LAST 30 DAYS</small><h3>Good morning.</h3><div className="metrics"><div><b>142</b><span>Sessions</span></div><div><b>119</b><span>PDFs created</span></div><div><b>106</b><span>Handoff actions</span></div></div><div className="activity"><b>Recent activity</b><span><i>✓</i> PDF created <small>2 min ago</small></span><span><i>↗</i> Share sheet opened <small>8 min ago</small></span><span><i>✓</i> PDF created <small>14 min ago</small></span></div></div></div></div>
      </section>

      <section className="privacy-section" id="privacy"><div className="privacy-seal"><span>◉</span><small>ON-DEVICE<br />PROCESSING</small></div><div><p className="marketing-kicker light">Privacy is the product</p><h2>The license image never becomes our data.</h2></div><div><p>Photos and PDFs stay in volatile browser memory on the customer’s device. LicenseResizer stores dealership settings and minimal workflow events—not license images, names, filenames, or document content.</p><a href="/capture">See the experience <span>→</span></a></div></section>

      <section className="final-cta"><p className="marketing-kicker">Make the next handoff easier</p><h2>Stop chasing license photos.</h2><p>Set up your dealership link and give every customer the same smooth, private experience.</p><a className="primary marketing-primary" href="/dashboard">Start your free trial <span>→</span></a><small>14 days free · No card required</small></section>

      <footer className="marketing-footer"><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /></span><span>License<span>Resizer</span></span></a><p>Private document capture for dealerships.</p><div><a href="/capture">Product demo</a><a href="/dashboard">Dealer sign in</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms</a><a href="/support">Support</a></div><small>© {new Date().getFullYear()} LicenseResizer. LicenseResizer resizes documents; it does not verify identity, authenticity, or delivery.</small></footer>
    </main>
  );
}
