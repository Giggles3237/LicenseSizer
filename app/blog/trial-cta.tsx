import Link from "next/link";

export default function LicenseResizerTrialCTA() {
  return (
    <section className="blog-trial-cta" aria-label="Start a LicenseResizer trial">
      <div>
        <span className="step-kicker">Dealer-ready workflow</span>
        <h2>Give customers one private link for license PDFs.</h2>
        <p>Start with a no-card trial, set your branded handoff details, and test the customer experience in minutes.</p>
      </div>
      <Link className="primary marketing-primary" href="/sign-up" data-analytics="start-free-trial">
        Start free trial <span aria-hidden="true">-&gt;</span>
      </Link>
    </section>
  );
}
