import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Subprocessors — LicenseResizer", description: "Third-party infrastructure used to operate LicenseResizer." };

export default function SubprocessorsPage() {
  return <LegalShell eyebrow="Trust center" title="Subprocessors" intro="LicenseResizer uses a small set of infrastructure providers for account access, hosting, configuration data, and billing. License images and PDFs are not intentionally sent to these providers by LicenseResizer.">
    <section><h2>Current providers</h2><div className="legal-table-wrap"><table><thead><tr><th>Provider</th><th>Purpose</th><th>Information involved</th></tr></thead><tbody>
      <tr><td>Vercel</td><td>Application hosting and delivery</td><td>Web requests, technical logs, and application responses</td></tr>
      <tr><td>Clerk</td><td>Authentication and dealership organizations</td><td>User account, session, organization, membership, and role information</td></tr>
      <tr><td>Neon</td><td>Managed PostgreSQL database</td><td>Dealership settings, minimal workflow events, and subscription state</td></tr>
      <tr><td>Stripe</td><td>Subscription checkout, billing portal, invoices, and payments</td><td>Billing contact, customer, subscription, invoice, tax, and payment information</td></tr>
    </tbody></table></div></section>
    <section><h2>Changes</h2><p>We may update this list when providers or processing purposes change. Dealerships with contractual notice requirements should contact <a href="mailto:privacy@licenseresizer.com">privacy@licenseresizer.com</a>.</p></section>
  </LegalShell>;
}
