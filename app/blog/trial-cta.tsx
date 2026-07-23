import Link from "next/link";

type LicenseResizerTrialCTAProps = {
  title?: string;
  description?: string;
  buttonText?: string;
  href?: string;
};

export default function LicenseResizerTrialCTA({
  title = "Give customers one private link for license PDFs.",
  description = "Start with a no-card trial, set your branded handoff details, and test the customer experience in minutes.",
  buttonText = "Start free trial",
  href = "/sign-up",
}: LicenseResizerTrialCTAProps) {
  return (
    <section className="blog-trial-cta" aria-label="Start a LicenseResizer trial">
      <div>
        <span className="step-kicker">Dealer-ready workflow</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Link className="primary marketing-primary" href={href} data-analytics="start-free-trial">
        {buttonText} <span aria-hidden="true">-&gt;</span>
      </Link>
    </section>
  );
}
