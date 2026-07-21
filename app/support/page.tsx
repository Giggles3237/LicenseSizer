import type { Metadata } from "next";
import Link from "next/link";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Support — LicenseResizer", description: "Get help with LicenseResizer dealership setup, customer capture, billing, privacy, or security." };

export default function SupportPage() {
  return <LegalShell eyebrow="Help center" title="How can we help?" intro="Choose the contact that matches your question. Never send a license image, PDF, license number, or other identity document to a LicenseResizer support address.">
    <section className="support-grid"><article><h2>Dealership setup</h2><p>For organization access, customer links, capture policies, branding, team roles, and general product help.</p><a className="secondary" href="mailto:support@licenseresizer.com?subject=LicenseResizer%20support">Email support</a></article><article><h2>Billing</h2><p>Organization administrators can manage payment methods, invoices, and cancellation from the secure billing portal.</p><Link className="secondary" href="/dashboard">Open dealer console</Link></article><article><h2>Privacy request</h2><p>Ask about stored dealership information or request eligible account and configuration deletion.</p><a className="secondary" href="mailto:privacy@licenseresizer.com?subject=Privacy%20request">Contact privacy</a></article><article><h2>Security issue</h2><p>Report a suspected vulnerability or security incident without attaching sensitive customer information.</p><a className="secondary" href="mailto:security@licenseresizer.com?subject=Security%20report">Contact security</a></article></section>
    <section><h2>Customer sharing help</h2><ol><li>Create and review the PDF in LicenseResizer.</li><li>Use the share sheet if your device supports PDF file sharing, or download the PDF.</li><li>Select the intended email or messaging application and verify the dealership recipient.</li><li>Confirm the PDF is attached, then send it from that application.</li></ol><p>LicenseResizer cannot see the selected app or recipient and cannot confirm delivery. Contact the dealership directly if you need confirmation.</p></section>
  </LegalShell>;
}
